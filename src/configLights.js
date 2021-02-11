import * as THREE from "three";

import { GUI } from "./GUI";
class ColorGUIHelper {
	constructor(object, prop) {
		this.object = object;
		this.prop = prop;
	}
	get value() {
		return `#${this.object[this.prop].getHexString()}`;
	}
	set value(hexString) {
		this.object[this.prop].set(hexString);
	}
}
function configLights(scene) {
	// LIGHTS
	var ambientLight = new THREE.AmbientLight(0x404040);
	ambientLight.position.set(260, 30, 200);
	scene.add(ambientLight);

	var dirLight = new THREE.DirectionalLight(0xffffff, 1);
	dirLight.position.set(0, 100, 0);
	dirLight.castShadow = true;
	scene.add(dirLight);
	scene.add(dirLight.target);

	dirLight.castShadow = true;
	// ambientLight.castShadow = true;

	dirLight.shadow.mapSize.width = 2000;
	dirLight.shadow.mapSize.height = 2000;

	let d = 50;

	dirLight.shadow.camera.left = -d;
	dirLight.shadow.camera.right = d;
	dirLight.shadow.camera.top = d;
	dirLight.shadow.camera.bottom = -d;

	const ambienLightHelper = new THREE.PointLightHelper(ambientLight);
	const dirLighHelper = new THREE.PointLightHelper(dirLight);

	scene.add(dirLighHelper);
	scene.add(ambienLightHelper);

	const gui = new GUI();
	gui.addColor(new ColorGUIHelper(dirLight, "color"), "value").name("dirColor");
	gui
		.addColor(new ColorGUIHelper(ambientLight, "color"), "value")
		.name("ambienColor");
	gui.add(dirLight, "intensity", 0, 2, 0.01);
	gui.add(ambientLight, "intensity", 0, 2, 0.01);
}

export default configLights;
