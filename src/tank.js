// https://bl.ocks.org/duhaime/fae9d11f86a4097df0bffe81ae24feae#index.html

import * as THREE from "three";
import Stats from "stats.js";
import AmmoJS from "ammo.js";

import { OrbitControls } from "./OrbitControls";

// Keybord actions
var actions = {};
var keysActions = {
	KeyW: "acceleration",
	KeyS: "braking",
	KeyA: "left",
	KeyD: "right"
};

var ZERO_QUATERNION = new THREE.Quaternion(0, 0, 0, 1);
var DISABLE_DEACTIVATION = 4;

var tanks, physicsWorld;

const runTankGame = (Ammo) => {
	var time;
	var syncList = [];

	function getScene() {
		var scene = new THREE.Scene();
		return scene;
	}

	function getCamera() {
		var aspectRatio = window.innerWidth / window.innerHeight;
		var camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
		camera.position.set(0, 3, -10);
		return camera;
	}

	function getLight(scene) {
		var directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
		scene.add(directionalLight);

		var ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
		scene.add(ambientLight);
		return light;
	}

	function getRenderer() {
		var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(window.innerWidth, window.innerHeight);
		document.body.appendChild(renderer.domElement);
		return renderer;
	}

	function getControls(camera, renderer) {
		var controls = new OrbitControls(camera, renderer.domElement);
		controls.zoomSpeed = 0.4;
		controls.panSpeed = 0.4;
		return controls;
	}

	function createChassisMesh(w, l, h) {
		var shape = new THREE.BoxGeometry(w, l, h, 1, 1, 1);
		const material = new THREE.MeshPhongMaterial({ color: 0x990000 });
		var mesh = new THREE.Mesh(shape, material);
		scene.add(mesh);
		return mesh;
	}

	function createWheelMesh(radius, width) {
		var t = new THREE.CylinderGeometry(radius, radius, width, 24, 1);
		t.rotateZ(Math.PI / 2);
		const material = new THREE.MeshPhongMaterial({ color: 0x990000 });
		var mesh = new THREE.Mesh(t, material);
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
				material
			)
		);
		scene.add(mesh);
		return mesh;
	}

	function createVehicle(pos, quat) {
		// Vehicle contants

		var chassisWidth = 1.8;
		var chassisHeight = 0.6;
		var chassisLength = 4;
		var massVehicle = 800;

		var wheelAxisPositionBack = -1;
		var wheelRadiusBack = 0.4;
		var wheelWidthBack = 0.3;
		var wheelHalfTrackBack = 1;
		var wheelAxisHeightBack = 0.3;

		var wheelAxisFrontPosition = 1.7;
		var wheelHalfTrackFront = 1;
		var wheelAxisHeightFront = 0.3;
		var wheelRadiusFront = 0.35;
		var wheelWidthFront = 0.2;

		var friction = 1000;
		var suspensionStiffness = 20.0;
		var suspensionDamping = 2.3;
		var suspensionCompression = 4.4;
		var suspensionRestLength = 0.6;
		var rollInfluence = 0.2;

		var steeringIncrement = 0.04;
		var steeringClamp = 0.5;
		var maxEngineForce = 2000;
		var maxBreakingForce = 100;

		// Chassis
		var geometry = new Ammo.btBoxShape(
			new Ammo.btVector3(
				chassisWidth * 0.5,
				chassisHeight * 0.5,
				chassisLength * 0.5
			)
		);
		var transform = new Ammo.btTransform();
		transform.setIdentity();
		transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
		transform.setRotation(
			new Ammo.btQuaternion(quat.x, quat.y, quat.z, quat.w)
		);
		var motionState = new Ammo.btDefaultMotionState(transform);
		var localInertia = new Ammo.btVector3(0, 0, 0);
		geometry.calculateLocalInertia(massVehicle, localInertia);
		var body = new Ammo.btRigidBody(
			new Ammo.btRigidBodyConstructionInfo(
				massVehicle,
				motionState,
				geometry,
				localInertia
			)
		);
		body.setActivationState(DISABLE_DEACTIVATION);
		physicsWorld.addRigidBody(body);
		var chassisMesh = createChassisMesh(
			chassisWidth,
			chassisHeight,
			chassisLength
		);

		// Raycast Vehicle
		var engineForce = 0;
		var vehicleSteering = 0;
		var breakingForce = 0;
		var tuning = new Ammo.btVehicleTuning();
		var rayCaster = new Ammo.btDefaultVehicleRaycaster(physicsWorld);
		var vehicle = new Ammo.btRaycastVehicle(tuning, body, rayCaster);
		vehicle.setCoordinateSystem(0, 1, 2);
		physicsWorld.addAction(vehicle);

		// Wheels
		var FRONT_LEFT = 0;
		var FRONT_RIGHT = 1;
		var BACK_LEFT = 2;
		var BACK_RIGHT = 3;
		var wheelMeshes = [];
		var wheelDirectionCS0 = new Ammo.btVector3(0, -1, 0);
		var wheelAxleCS = new Ammo.btVector3(-1, 0, 0);

		function addWheel(isFront, pos, radius, width, index) {
			var wheelInfo = vehicle.addWheel(
				pos,
				wheelDirectionCS0,
				wheelAxleCS,
				suspensionRestLength,
				radius,
				tuning,
				isFront
			);

			wheelInfo.set_m_suspensionStiffness(suspensionStiffness);
			wheelInfo.set_m_wheelsDampingRelaxation(suspensionDamping);
			wheelInfo.set_m_wheelsDampingCompression(suspensionCompression);
			wheelInfo.set_m_frictionSlip(friction);
			wheelInfo.set_m_rollInfluence(rollInfluence);

			wheelMeshes[index] = createWheelMesh(radius, width);
		}

		addWheel(
			true,
			new Ammo.btVector3(
				wheelHalfTrackFront,
				wheelAxisHeightFront,
				wheelAxisFrontPosition
			),
			wheelRadiusFront,
			wheelWidthFront,
			FRONT_LEFT
		);
		addWheel(
			true,
			new Ammo.btVector3(
				-wheelHalfTrackFront,
				wheelAxisHeightFront,
				wheelAxisFrontPosition
			),
			wheelRadiusFront,
			wheelWidthFront,
			FRONT_RIGHT
		);
		addWheel(
			false,
			new Ammo.btVector3(
				-wheelHalfTrackBack,
				wheelAxisHeightBack,
				wheelAxisPositionBack
			),
			wheelRadiusBack,
			wheelWidthBack,
			BACK_LEFT
		);
		addWheel(
			false,
			new Ammo.btVector3(
				wheelHalfTrackBack,
				wheelAxisHeightBack,
				wheelAxisPositionBack
			),
			wheelRadiusBack,
			wheelWidthBack,
			BACK_RIGHT
		);

		// Sync keybord actions and physics and graphics
		function sync() {
			var speed = vehicle.getCurrentSpeedKmHour();

			speedometer.innerHTML =
				(speed < 0 ? "(R) " : "") + Math.abs(speed).toFixed(1) + " km/h";

			breakingForce = 0;
			engineForce = 0;

			if (actions.acceleration) {
				if (speed < -1) breakingForce = maxBreakingForce;
				else engineForce = maxEngineForce;
			}
			if (actions.braking) {
				if (speed > 1) breakingForce = maxBreakingForce;
				else engineForce = -maxEngineForce / 2;
			}
			if (actions.left) {
				if (vehicleSteering < steeringClamp)
					vehicleSteering += steeringIncrement;
			} else {
				if (actions.right) {
					if (vehicleSteering > -steeringClamp)
						vehicleSteering -= steeringIncrement;
				} else {
					if (vehicleSteering < -steeringIncrement)
						vehicleSteering += steeringIncrement;
					else {
						if (vehicleSteering > steeringIncrement)
							vehicleSteering -= steeringIncrement;
						else {
							vehicleSteering = 0;
						}
					}
				}
			}

			vehicle.applyEngineForce(engineForce, BACK_LEFT);
			vehicle.applyEngineForce(engineForce, BACK_RIGHT);

			vehicle.setBrake(breakingForce / 2, FRONT_LEFT);
			vehicle.setBrake(breakingForce / 2, FRONT_RIGHT);
			vehicle.setBrake(breakingForce, BACK_LEFT);
			vehicle.setBrake(breakingForce, BACK_RIGHT);

			vehicle.setSteeringValue(vehicleSteering, FRONT_LEFT);
			vehicle.setSteeringValue(vehicleSteering, FRONT_RIGHT);

			var tm, p, q, i;
			var n = vehicle.getNumWheels();
			for (i = 0; i < n; i++) {
				vehicle.updateWheelTransform(i, true);
				tm = vehicle.getWheelTransformWS(i);
				p = tm.getOrigin();
				q = tm.getRotation();
				wheelMeshes[i].position.set(p.x(), p.y(), p.z());
				wheelMeshes[i].quaternion.set(q.x(), q.y(), q.z(), q.w());
			}

			tm = vehicle.getChassisWorldTransform();
			p = tm.getOrigin();
			q = tm.getRotation();
			chassisMesh.position.set(p.x(), p.y(), p.z());
			chassisMesh.quaternion.set(q.x(), q.y(), q.z(), q.w());
		}

		syncList.push(sync);
	}

	var Tank = function (options) {
		this.mesh = new THREE.Object3D();
		this.mesh.name = "tank";
		this.width = 3;
		this.height = 1.1;
		this.depth = 2;
		this.nWheels = 6;
		this.color = options.color || 0x107d23;

		// bottom
		var geometry = new THREE.BoxGeometry(3, 1.1, 2);
		var material = new THREE.MeshPhongMaterial({ color: this.color });
		var cube = new THREE.Mesh(geometry, material);
		this.mesh.add(cube);

		// wheels
		for (var i = 0; i < this.nWheels; i++) {
			var geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
			var material = new THREE.MeshPhongMaterial({
				color: 0x454545,
				flatShading: true
			});
			var wheel = new THREE.Mesh(geometry, material);
			// positions
			if (i < this.nWheels / 2) wheel.position.z = -(this.depth / 2);
			else wheel.position.z = this.depth / 2;
			wheel.position.x = (i % (this.nWheels / 2)) - this.width / 2 + 0.5;
			wheel.position.y = -this.height / 2;
			// name and rotation
			wheel.name = "wheel";
			wheel.rotation.x = Math.PI / 2;
			this.mesh.add(wheel);
		}

		var turret = new Turret(options);
		this.mesh.add(turret.mesh);
	};

	var Turret = function (options) {
		this.color = options.color || 0x107d23;

		// turret
		this.mesh = new THREE.Object3D();

		// base
		var geometry = new THREE.BoxGeometry(1.7, 1.8, 1.2);
		var material = new THREE.MeshPhongMaterial({ color: this.color });
		var base = new THREE.Mesh(geometry, material);
		this.mesh.add(base);

		// pipe
		var geometry = new THREE.CylinderGeometry(0.3, 0.3, 2, 10);
		var material = new THREE.MeshPhongMaterial({
			color: 0x222222,
			flatShading: true
		});
		var pipe = new THREE.Mesh(geometry, material);
		pipe.rotation.x = Math.PI / 2;
		pipe.rotation.z = Math.PI / 2;
		pipe.position.y = 0.5;
		pipe.position.x = -0.5;
		this.mesh.add(pipe);

		// turret position
		this.mesh.position.y = 0.5;
	};

	function getTanks() {
		var colors = [0x0e679e, 0x9e220e];
		const tanks = [];
		for (var i = 0; i < 2; i++) {
			var tank = new Tank({ color: colors[i] });
			tank.mesh.position.x = -10 + i * 10;
			tank.mesh.position.y = 1;
			tank.mesh.position.z = -10 + i * 10;
			if (i === 0) tank.mesh.rotation.y = Math.PI;
			scene.add(tank.mesh);
			tanks.push(tank);
			// syncList.push(sync);
		}
		return tanks;
	}

	function getFloor() {
		var geometry = new THREE.PlaneGeometry(500, 500, 32);
		var material = new THREE.MeshBasicMaterial({ color: 0xf7d9aa });
		var floor = new THREE.Mesh(geometry, material);
		floor.rotation.x = -Math.PI / 2;
		scene.add(floor);
	}

	function initPhysics() {
		// Physics configuration
		const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration();
		const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration);
		const broadphase = new Ammo.btDbvtBroadphase();
		const solver = new Ammo.btSequentialImpulseConstraintSolver();
		const physicsWorld = new Ammo.btDiscreteDynamicsWorld(
			dispatcher,
			broadphase,
			solver,
			collisionConfiguration
		);
		physicsWorld.setGravity(new Ammo.btVector3(0, -9.82, 0));
		return physicsWorld;
	}

	function getStats() {
		const container = document.getElementById("container");
		const stats = new Stats();
		stats.domElement.style.position = "absolute";
		stats.domElement.style.top = "0px";
		container.appendChild(stats.domElement);
		return stats;
	}

	function render() {
		requestAnimationFrame(render);
		var dt = new THREE.Clock().getDelta();
		renderer.render(scene, camera);
		for (var i = 0; i < syncList.length; i++) syncList[i](dt);
		physicsWorld.stepSimulation(dt, 10);
		controls.update();
	}

	function keydown(e) {
		if (keysActions[e.code]) {
			actions[keysActions[e.code]] = true;
			e.preventDefault();
			e.stopPropagation();
			return false;
		}
	}

	var scene = getScene();
	var camera = getCamera();
	var light = getLight(scene);
	physicsWorld = initPhysics();
	console.log(physicsWorld);
	var renderer = getRenderer(physicsWorld);
	var controls = getControls(camera, renderer);
	var stats = getStats(camera, renderer);

	// geoms
	getFloor();
	tanks = getTanks();
	render();
	createVehicle(new THREE.Vector3(10, 4, 20), ZERO_QUATERNION);
};

const loadDependencies = () => {
	AmmoJS().then(runTankGame);
};

export default loadDependencies();
