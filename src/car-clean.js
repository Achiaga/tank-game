import * as THREE from "three";
import Stats from "stats.js";
import AmmoFunc from "ammo.js";

import { OrbitControls } from "./OrbitControls";
import { GUI } from "./GUI";
import Detector from "./Detector";

var Ammo;

var DISABLE_DEACTIVATION;
var TRANSFORM_AUX;
var ZERO_QUATERNION;

// Graphics variables
var container, stats, speedometer;
var camera, controls, scene, renderer;
var terrainMesh, texture;
var clock = new THREE.Clock();
var materialDynamic, materialStatic, materialInteractive;

// Physics variables
var collisionConfiguration;
var dispatcher;
var broadphase;
var solver;
var physicsWorld;

// Keybord actions
var actions = {};
var keysActions = {
	KeyW: "acceleration",
	KeyS: "braking",
	KeyA: "left",
	KeyD: "right"
};
var syncList = [];

class Car {
	constructor(pos, quat) {
		this.pos = pos;
		this.quat = quat;
		this.chassisWidth = 1;
		this.chassisHeight = 1;
		this.chassisLength = 2;
		this.massVehicle = 800;

		this.wheelAxisPositionBack = -1;
		this.wheelRadiusBack = 0.4;
		this.wheelWidthBack = 0.3;
		this.wheelHalfTrackBack = 0.7;
		this.wheelAxisHeightBack = 0.3;

		this.wheelAxisFrontPosition = 1;
		this.wheelHalfTrackFront = 0.7;
		this.wheelAxisHeightFront = 0.3;
		this.wheelRadiusFront = 0.4;
		this.wheelWidthFront = 0.3;

		this.friction = 1000;
		this.suspensionStiffness = 20.0;
		this.suspensionDamping = 2.3;
		this.suspensionCompression = 4.4;
		this.suspensionRestLength = 0.6;
		this.rollInfluence = 0.2;

		this.steeringIncrement = 0.04;
		this.steeringClamp = 0.5;
		this.maxEngineForce = 2000;
		this.maxBreakingForce = 100;

		this.body;
		this.vehicle;
		this.wheelMeshes = [];
		this.wheelDirectionCS0 = new Ammo.btVector3(0, -1, 0);
		this.wheelAxleCS = new Ammo.btVector3(-1, 0, 0);

		// Wheels
		this.FRONT_LEFT = 0;
		this.FRONT_RIGHT = 1;
		this.BACK_LEFT = 2;
		this.BACK_RIGHT = 3;

		this.engineForce = 0;
		this.vehicleSteering = 0;
		this.breakingForce = 0;

		this.sync = this.sync.bind(this);
		this.createVehicle = this.createVehicle.bind(this);
	}

	createChassisMesh(w, l, h) {
		var shape = new THREE.BoxGeometry(w, l, h, 1, 1, 1);
		var mesh = new THREE.Mesh(shape, materialInteractive);
		scene.add(mesh);
		return mesh;
	}

	setChasis() {
		const geometry = new Ammo.btBoxShape(
			new Ammo.btVector3(
				this.chassisWidth * 0.5,
				this.chassisHeight * 0.5,
				this.chassisLength * 0.5
			)
		);
		const transform = new Ammo.btTransform();
		transform.setIdentity();
		transform.setOrigin(new Ammo.btVector3(this.pos.x, this.pos.y, this.pos.z));
		transform.setRotation(
			new Ammo.btQuaternion(this.quat.x, this.quat.y, this.quat.z, this.quat.w)
		);
		const motionState = new Ammo.btDefaultMotionState(transform);
		const localInertia = new Ammo.btVector3(0, 0, 0);
		geometry.calculateLocalInertia(this.massVehicle, localInertia);
		this.body = new Ammo.btRigidBody(
			new Ammo.btRigidBodyConstructionInfo(
				this.massVehicle,
				motionState,
				geometry,
				localInertia
			)
		);
		this.body.setActivationState(DISABLE_DEACTIVATION);
		physicsWorld.addRigidBody(this.body);
		this.chassisMesh = this.createChassisMesh(
			this.chassisWidth,
			this.chassisHeight,
			this.chassisLength
		);
	}

	setRaycasteVehicle() {
		const tuning = new Ammo.btVehicleTuning();
		const rayCaster = new Ammo.btDefaultVehicleRaycaster(physicsWorld);
		this.vehicle = new Ammo.btRaycastVehicle(tuning, this.body, rayCaster);
		this.vehicle.setCoordinateSystem(0, 1, 2);
		physicsWorld.addAction(this.vehicle);
	}

	addWheel(isFront, pos, radius, width, index) {
		var wheelInfo = this.vehicle.addWheel(
			pos,
			this.wheelDirectionCS0,
			this.wheelAxleCS,
			this.suspensionRestLength,
			radius,
			this.tuning,
			isFront
		);

		wheelInfo.set_m_suspensionStiffness(this.suspensionStiffness);
		wheelInfo.set_m_wheelsDampingRelaxation(this.suspensionDamping);
		wheelInfo.set_m_wheelsDampingCompression(this.suspensionCompression);
		wheelInfo.set_m_frictionSlip(this.friction);
		wheelInfo.set_m_rollInfluence(this.rollInfluence);

		this.wheelMeshes[index] = this.createWheelMesh(radius, width);
	}

	setWheels() {
		this.addWheel(
			true,
			new Ammo.btVector3(
				this.wheelHalfTrackFront,
				this.wheelAxisHeightFront,
				this.wheelAxisFrontPosition
			),
			this.wheelRadiusFront,
			this.wheelWidthFront,
			this.FRONT_LEFT
		);
		this.addWheel(
			true,
			new Ammo.btVector3(
				-this.wheelHalfTrackFront,
				this.wheelAxisHeightFront,
				this.wheelAxisFrontPosition
			),
			this.wheelRadiusFront,
			this.wheelWidthFront,
			this.FRONT_RIGHT
		);
		this.addWheel(
			false,
			new Ammo.btVector3(
				-this.wheelHalfTrackBack,
				this.wheelAxisHeightBack,
				this.wheelAxisPositionBack
			),
			this.wheelRadiusBack,
			this.wheelWidthBack,
			this.BACK_LEFT
		);
		this.addWheel(
			false,
			new Ammo.btVector3(
				this.wheelHalfTrackBack,
				this.wheelAxisHeightBack,
				this.wheelAxisPositionBack
			),
			this.wheelRadiusBack,
			this.wheelWidthBack,
			this.BACK_RIGHT
		);
	}

	createWheelMesh(radius, width) {
		var t = new THREE.CylinderGeometry(radius, radius, width, 24, 1);
		t.rotateZ(Math.PI / 2);
		var mesh = new THREE.Mesh(t, materialInteractive);
		mesh.add(
			new THREE.Mesh(
				new THREE.BoxGeometry(
					width * 1.5,
					radius * 1.75,
					radius * 0.25,
					1,
					1,
					1
				),
				materialInteractive
			)
		);
		scene.add(mesh);
		return mesh;
	}

	sync() {
		var speed = this.vehicle.getCurrentSpeedKmHour();
		speedometer.innerHTML =
			(speed < 0 ? "(R) " : "") + Math.abs(speed).toFixed(1) + " km/h";

		console.log(speed);

		this.breakingForce = 0;
		this.engineForce = 0;

		speed = 50;

		if (actions.acceleration) {
			if (speed < -1) this.breakingForce = this.maxBreakingForce;
			else this.engineForce = this.maxEngineForce;
		}
		if (actions.braking) {
			if (speed > 1) this.breakingForce = this.maxBreakingForce;
			else this.engineForce = -this.maxEngineForce / 2;
		}
		if (actions.left) {
			if (this.vehicleSteering < this.steeringClamp)
				this.vehicleSteering += this.steeringIncrement;
		} else {
			if (actions.right) {
				if (this.vehicleSteering > -this.steeringClamp)
					this.vehicleSteering -= this.steeringIncrement;
			} else {
				if (this.vehicleSteering < -this.steeringIncrement)
					this.vehicleSteering += this.steeringIncrement;
				else {
					if (this.vehicleSteering > this.steeringIncrement)
						this.vehicleSteering -= this.steeringIncrement;
					else {
						this.vehicleSteering = 0;
					}
				}
			}
		}

		this.vehicle.applyEngineForce(this.engineForce, this.BACK_LEFT);
		this.vehicle.applyEngineForce(this.engineForce, this.BACK_RIGHT);
		this.vehicle.setBrake(this.breakingForce / 2, this.FRONT_LEFT);
		this.vehicle.setBrake(this.breakingForce / 2, this.FRONT_RIGHT);
		this.vehicle.setBrake(this.breakingForce, this.BACK_LEFT);
		this.vehicle.setBrake(this.breakingForce, this.BACK_RIGHT);
		this.vehicle.setSteeringValue(this.vehicleSteering, this.FRONT_LEFT);
		this.vehicle.setSteeringValue(this.vehicleSteering, this.FRONT_RIGHT);

		var tm, p, q, i;
		var n = this.vehicle.getNumWheels();

		for (i = 0; i < n; i++) {
			this.vehicle.updateWheelTransform(i, true);
			tm = this.vehicle.getWheelTransformWS(i);
			p = tm.getOrigin();
			q = tm.getRotation();
			this.wheelMeshes[i].position.set(p.x(), p.y(), p.z());
			this.wheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
		}

		tm = this.vehicle.getChassisWorldTransform();
		p = tm.getOrigin();
		q = tm.getRotation();
		this.chassisMesh.position.set(p.x(), p.y(), p.z());
		this.chassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
	}

	createVehicle() {
		this.setChasis();
		this.setRaycasteVehicle();
		this.setWheels();
		syncList.push(this.sync);
	}
}

export default AmmoFunc().then(function (AmmoInit) {
	Ammo = AmmoInit;
	// Detects webgl
	if (!Detector.webgl) {
		Detector.addGetWebGLMessage();
		document.getElementById("container").innerHTML = "";
	}

	DISABLE_DEACTIVATION = 4;
	TRANSFORM_AUX = new Ammo.btTransform();
	ZERO_QUATERNION = new THREE.Quaternion(0, 0, 0, 1);

	var time = 0;
	var objectTimePeriod = 3;
	var timeNextSpawn = time + objectTimePeriod;
	var maxNumObjects = 30;

	// - Functions -

	function initGraphics() {
		container = document.getElementById("container");
		speedometer = document.getElementById("speedometer");

		scene = new THREE.Scene();

		camera = new THREE.PerspectiveCamera(
			60,
			window.innerWidth / window.innerHeight,
			0.2,
			2000
		);
		camera.position.x = -4.84;
		camera.position.y = 4.39;
		camera.position.z = -35.11;
		camera.lookAt(new THREE.Vector3(0.33, -0.4, 0.85));

		stats = new Stats();
		stats.domElement.style.position = "absolute";
		stats.domElement.style.top = "0px";
		container.appendChild(stats.domElement);

		renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setClearColor(0xbfd1e5);
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);

		controls = new OrbitControls(camera, renderer.domElement);

		var ambientLight = new THREE.AmbientLight(0x404040);
		scene.add(ambientLight);

		var dirLight = new THREE.DirectionalLight(0xffffff, 1);
		dirLight.position.set(10, 10, 5);
		scene.add(dirLight);

		materialDynamic = new THREE.MeshPhongMaterial({ color: 0xfca400 });
		materialStatic = new THREE.MeshPhongMaterial({ color: 0x999999 });
		materialInteractive = new THREE.MeshPhongMaterial({ color: 0x990000 });

		container.innerHTML = "";

		container.appendChild(renderer.domElement);

		window.addEventListener("resize", onWindowResize, false);
		window.addEventListener("keydown", keydown);
		window.addEventListener("keyup", keyup);
	}

	function onWindowResize() {
		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize(window.innerWidth, window.innerHeight);
	}

	function initPhysics() {
		// Physics configuration
		collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
		dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
		broadphase = new Ammo.btDbvtBroadphase();
		solver = new Ammo.btSequentialImpulseConstraintSolver();
		physicsWorld = new Ammo.btDiscreteDynamicsWorld(
			dispatcher,
			broadphase,
			solver,
			collisionConfiguration
		);
		physicsWorld.setGravity(new Ammo.btVector3(0, -9.82, 0));
	}

	function syncAllObjects(dt) {
		for (var i = 0; i < syncList.length; i++) {
			syncList[i](dt);
		}
	}

	function tick() {
		requestAnimationFrame(tick);
		var dt = clock.getDelta();
		syncAllObjects(dt);
		physicsWorld.stepSimulation(dt, 10);
		controls.update(dt);
		renderer.render(scene, camera);
		time += dt;
		stats.update();
	}

	function keyup(e) {
		if (keysActions[e.code]) {
			actions[keysActions[e.code]] = false;
			e.preventDefault();
			e.stopPropagation();
			return false;
		}
	}

	function keydown(e) {
		if (keysActions[e.code]) {
			console.log(keysActions[e.code]);
			actions[keysActions[e.code]] = true;
			e.preventDefault();
			e.stopPropagation();
			return false;
		}
	}

	function createBox(pos, quat, w, l, h, mass, friction) {
		var material = mass > 0 ? materialDynamic : materialStatic;
		var shape = new THREE.BoxGeometry(w, l, h, 1, 1, 1);
		var geometry = new Ammo.btBoxShape(
			new Ammo.btVector3(w * 0.5, l * 0.5, h * 0.5)
		);

		if (!mass) mass = 0;
		if (!friction) friction = 1;

		var mesh = new THREE.Mesh(shape, material);
		mesh.position.copy(pos);
		mesh.quaternion.copy(quat);
		scene.add(mesh);

		var transform = new Ammo.btTransform();
		transform.setIdentity();
		transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
		transform.setRotation(
			new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w)
		);
		var motionState = new Ammo.btDefaultMotionState(transform);

		var localInertia = new Ammo.btVector3(0, 0, 0);
		geometry.calculateLocalInertia(mass, localInertia);

		var rbInfo = new Ammo.btRigidBodyConstructionInfo(
			mass,
			motionState,
			geometry,
			localInertia
		);
		var body = new Ammo.btRigidBody(rbInfo);

		body.setFriction(friction);
		//body.setRestitution(.9);
		//body.setDamping(0.2, 0.2);

		physicsWorld.addRigidBody(body);

		if (mass > 0) {
			body.setActivationState(DISABLE_DEACTIVATION);
			// Sync physics and graphics
			function sync(dt) {
				var ms = body.getMotionState();
				if (ms) {
					ms.getWorldTransform(TRANSFORM_AUX);
					var p = TRANSFORM_AUX.getOrigin();
					var q = TRANSFORM_AUX.getRotation();
					mesh.position.set(p.x(), p.y(), p.z());
					mesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
				}
			}

			syncList.push(sync);
		}
	}

	function createObjects() {
		// ground
		createBox(new THREE.Vector3(0, -0.5, 0), ZERO_QUATERNION, 75, 1, 75, 0, 2);

		// var quaternion = new THREE.Quaternion(0, 0, 0, 1);
		// quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 18);
		// createBox(new THREE.Vector3(0, -1.5, 0), quaternion, 8, 4, 10, 0);

		// var size = 0.75;
		// var nw = 8;
		// var nh = 6;
		// for (var j = 0; j < nw; j++)
		// 	for (var i = 0; i < nh; i++)
		// 		createBox(
		// 			new THREE.Vector3(size * j - (size * (nw - 1)) / 2, size * i, 10),
		// 			ZERO_QUATERNION,
		// 			size,
		// 			size,
		// 			size,
		// 			10
		// 		);
		new Car(new THREE.Vector3(0, 4, -20), ZERO_QUATERNION).createVehicle();
	}

	// - Init -
	initGraphics();
	initPhysics();
	createObjects();
	tick();
});
