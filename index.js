/**
 * NAVODILA
 * - samo odpreš index.html v browserju po tem ko zalufaš backend server
 * */

import * as THREE from './three.js';
import { OBJLoader } from './OBJLoader.js';
import { MTLLoader } from './MTLLoader.js';

let renderer, scene, camera;
let car = null;
let ground = null;
let carSpeed = 0.005;

let carTemplate = null;
let parkingTemplate = null;

let parkingSpaces = [];
let parkedCars = [];

init();
animate();

function init() {
    renderer = new THREE.WebGLRenderer();
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene = new THREE.Scene();

    // POGLED KAMERE
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(-30, 20, 40);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    // LUČ
    const light = new THREE.DirectionalLight(0xffffff, 0.5);
    light.castShadow = true;
    light.position.set(0, 100, 0);
    scene.add(light);

    // TLA
    ground = new THREE.Mesh(
        new THREE.BoxGeometry(100, 1, 1000),
        new THREE.MeshLambertMaterial({ color: 0xffaaaa })
    );
    ground.castShadow = true;
    ground.receiveShadow = true;
    ground.position.y = -2;
    scene.add(ground);

    // pred-naložimo avto
    preloadModel("rac_grafika_model_armatura2.mtl", "rac_grafika_model_armatura2.obj", (obj) => {
        carTemplate = obj;
        carTemplate.rotation.y += Math.PI / 2;

        // glavni avto
        car = cloneObject(carTemplate);
        car.position.set(0, 0, 0);
        scene.add(car);
    });

    // pred-naložimo parkirno mesto
    // TODO rabimo dodati invalidska
    preloadModel("x.mtl", "parkirna_mesta.obj", (obj) => {
        parkingTemplate = obj;
        parkingTemplate.rotation.y -= Math.PI / 2;
    });

    window.addEventListener('resize', onWindowResize);
}

function preloadModel(mtl, obj, callback) {
    const mtlLoader = new MTLLoader();
    mtlLoader.load(mtl, (materials) => {
        materials.preload();
        const objLoader = new OBJLoader();
        objLoader.setMaterials(materials);
        objLoader.load(obj, (object) => {
            object.traverse(child => {
                if (child instanceof THREE.Mesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            callback(object);
        });
    });
}

function cloneObject(template) {
    const clone = template.clone(true);

    clone.traverse((child) => {
        if (!child.isMesh) return;

        if (child.material && child.material.clone) {
            child.material = child.material.clone();
            return;
        }

        if (Array.isArray(child.material)) {
            child.material = child.material.map(m =>
                m && m.clone ? m.clone() : m
            );
            return;
        }

        // fallback ko ni materialov
        if (!child.material) {
            child.material = new THREE.MeshLambertMaterial({ color: 0xffffff });
            return;
        }

        child.material = new THREE.MeshLambertMaterial({
            color: child.material.color || 0xffffff
        });
    });

    scene.add(clone);
    return clone;
}

// TODO mogoče namesto risanja + brisanja samo cachiramo in premikamo objekte
function removeObject(obj) {
    if (!obj) return;

    scene.remove(obj);

    obj.traverse(child => {
        if (!child.isMesh) return;

        if (child.geometry) child.geometry.dispose();

        if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose && m.dispose());
        } else if (child.material && child.material.dispose) {
            child.material.dispose();
        }
    });
}

// TODO isto kot eno gor
function clearSpawnedObjects() {
    parkedCars.forEach(obj => removeObject(obj));
    parkedCars.length = 0;

    parkingSpaces.forEach(obj => removeObject(obj));
    parkingSpaces.length = 0;
}

// websocke povezav
const ws = new WebSocket("ws://localhost:8000/ws");

ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    const detections = data.detections;

    if (!detections || !detections.length) return;

    clearSpawnedObjects();

    // TODO filtriramo avtomobile v ozadju in ostale detekcije -> mogoče kr na bcakendu
    detections.forEach(det => {

        if (det.label === "Avtomobil" && carTemplate) {
            const leftToRight = det.left_to_right;  // 0 do 100

            // TODO najdemo prave koordinate / vrednosti
            // interpoliramo
            const zPos = THREE.MathUtils.lerp(-20, 20, leftToRight / 100);

            const newCar = cloneObject(carTemplate);

            newCar.rotation.y -= Math.PI / 2;
            newCar.position.set(10, 0, zPos);
            parkedCars.push(newCar);
        }

        // TODO bolj precizno + različni parkingi
        if (det.label.includes("parki") && parkingTemplate) {
            const leftToRight = det.left_to_right;  // 0 do 100

            const zPos = THREE.MathUtils.lerp(-20, 20, leftToRight / 100);

            const newParking = cloneObject(parkingTemplate);
            newParking.position.set(10, 0, zPos);
            parkingSpaces.push(newParking);
        }
    });
};

function animate() {
    requestAnimationFrame(animate);

    if (car) {
        parkingSpaces.forEach(space => space.position.z += carSpeed);
        parkedCars.forEach(c => c.position.z += carSpeed);
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}