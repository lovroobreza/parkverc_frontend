// index.js
import * as THREE from './three.js';
import { OBJLoader } from './OBJLoader.js';
import { MTLLoader } from './MTLLoader.js';

let renderer;
let scene;
let camera;
let monkey = null;

init();
animate();

function init() {
    // Renderer
    renderer = new THREE.WebGLRenderer();
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Scene & camera
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(10, 20, 40);
    camera.lookAt(0, 0, 0);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.2));

    const light = new THREE.DirectionalLight(0xffffff, 0.5);
    light.castShadow = true;
    light.position.set(0, 100, 0);

    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 1000;
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;

    scene.add(light);

    // Ground
    const ground = new THREE.Mesh(
        new THREE.BoxGeometry(10, 1, 10),
        new THREE.MeshLambertMaterial({ color: 0xffaaaa })
    );
    ground.castShadow = true;
    ground.receiveShadow = true;
    ground.position.y = -2;
    scene.add(ground);

    // Load OBJ + MTL (parkirna_mesta)
    loadModel();

    // Handle resize
    window.addEventListener('resize', onWindowResize);
}

function loadModel() {
    const mtlLoader = new MTLLoader();

    mtlLoader.load(
        'x.mtl',
        materials => {
            materials.preload();

            const objLoader = new OBJLoader();
            objLoader.setMaterials(materials);
            objLoader.load(
                'parkirna_mesta.obj',
                object => {
                    monkey = object;

                    monkey.traverse(child => {
                        if (child instanceof THREE.Mesh) {
                            console.log('Ime objekta: ' + child.name);
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });

                    scene.add(monkey);
                },
                xhr => {
                    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                error => {
                    console.error('An error happened', error);
                }
            );
        },
        undefined,
        error => {
            console.error('Error loading MTL', error);
        }
    );
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    if (monkey) {
        monkey.castShadow = true;
        monkey.receiveShadow = true;

    }

    renderer.render(scene, camera);
}