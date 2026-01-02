"use client";

import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { LightningStrike } from "./utils/LightningStrike";

import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { CatmullRomCurve3 } from 'three';
import { TubeGeometry } from 'three';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import type { Font } from 'three/examples/jsm/loaders/FontLoader.js';

export default function ThreeScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const lightningStrikeRef = useRef<LightningStrike | null>(null);
  const allCloudGroupsRef = useRef<THREE.Group[]>([]);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [simStatus, setSimStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const simStatusRef = useRef<'idle' | 'running' | 'paused'>('idle');
  const startRef = useRef<() => void>(() => {});
  const pauseRef = useRef<() => void>(() => {});
  const resumeRef = useRef<() => void>(() => {});
  const resetRef = useRef<() => void>(() => {});

  useEffect(() => {
    simStatusRef.current = simStatus;
  }, [simStatus]);

    const rainCount = 2000000; // Tăng số lượng hạt mưa để tạo hiệu ứng bão lớn

  useEffect(() => {
    const mount = mountRef.current!;
    const scene = new THREE.Scene();
    const cityGroups = [];
    for (let i = 0; i < 2; i++) {
      const cityGroup = new THREE.Group(); // Group for houses and roads
            cityGroup.position.y = 0.5;



            const posX = i % 2 === 0 ? 150 : -150; // Đặt các nhóm thành phố trên bờ sông
            cityGroup.position.x = posX; // Vị trí X ngẫu nhiên ở hai bên sông
      cityGroup.position.z = (Math.random() * 100) + 50; // Đặt các nhóm thành phố gần sông hơn và tránh núi
      scene.add(cityGroup);
      cityGroups.push(cityGroup);
    }

    const riverWidth = 100; // Chiều rộng của sông
    const riverHalfWidth = riverWidth / 2; // Một nửa chiều rộng sông
    const minDistanceFromRiver = 10; // Khoảng cách tối thiểu từ mép sông

    const textureLoader = new THREE.TextureLoader();

    // Load water textures
    const waterNormalTexture = textureLoader.load(
        '/textures/water/water_normal.jpg', // Assuming you have a water normal map
        () => console.log('waterNormalTexture loaded successfully'),
        undefined,
        (error) => console.error('Error loading waterNormalTexture:', error)
    );
    waterNormalTexture.wrapS = THREE.RepeatWrapping;
    waterNormalTexture.wrapT = THREE.RepeatWrapping;
    waterNormalTexture.repeat.set(6, 6);

    // River Material with Shader
    const waterShader = {
        uniforms: {
            tDiffuse: { value: null },
            time: { value: 0.0 },
            waterNormal: { value: waterNormalTexture },
            floodLevel: { value: 0.0 }, // Add floodLevel uniform
            flowIntensity: { value: 1.0 } // Add flowIntensity uniform, default to 1.0
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform sampler2D waterNormal;
            uniform float floodLevel; // Declare floodLevel uniform
            uniform float flowIntensity; // Declare flowIntensity uniform
            varying vec2 vUv;

            void main() {
                vec2 uv = vUv * 6.0;
                vec2 uv1 = uv + vec2(0.0, time * flowIntensity * 0.12);
                vec2 uv2 = uv + vec2(time * flowIntensity * 0.06, 0.0);
                vec3 n1 = texture2D(waterNormal, uv1).rgb;
                vec3 n2 = texture2D(waterNormal, uv2).rgb;
                vec3 n = normalize((n1 * 2.0 - 1.0) + (n2 * 2.0 - 1.0));

                vec3 turquoise = vec3(0.05, 0.35, 0.55);
                vec3 muddy = vec3(0.40, 0.22, 0.08);
                float floodFactor = clamp((floodLevel + 0.1) / 1.0, 0.0, 0.5);
                vec3 baseColor = mix(turquoise, muddy, floodFactor);

                float centerBright = 1.0 - smoothstep(0.0, 0.30, abs(vUv.x - 0.5));
                vec3 waterColor = baseColor + vec3(0.03, 0.06, 0.07) * centerBright;

                vec3 lightDir = normalize(vec3(0.5, 1.0, 0.5));
                float diffuse = max(dot(n, lightDir), 0.0);
                float spec = pow(max(dot(n, lightDir), 0.0), 14.0) * 0.07;

                vec3 color = waterColor + diffuse * 0.22 + spec;
                gl_FragColor = vec4(color, 0.9);
            }
        `
    };

    const riverMaterial = new THREE.ShaderMaterial(waterShader);

    const mountainRiverMaterial = new THREE.ShaderMaterial({
        uniforms: {
            ...waterShader.uniforms,
            flowIntensity: { value: -1.0 } // Ngược dòng chảy
        },
        vertexShader: waterShader.vertexShader,
        fragmentShader: waterShader.fragmentShader
    });

    // River
    const riverGeometry = new THREE.BoxGeometry(riverWidth, 1000, 0.1); // Chiều dài 1000 để kéo dài qua cảnh, chiều cao ban đầu 0.1
    const river = new THREE.Mesh(riverGeometry, riverMaterial);
    river.rotation.x = -Math.PI / 2; // Xoay để mặt phẳng nằm ngang
    river.position.y = -0.1; // Đặt thấp hơn mặt đất một chút
    const initialRiverY = river.position.y;
    const initialRiverDepth = 0.1; // Chiều sâu ban đầu của BoxGeometry
    river.position.z = 0; // Đặt ở giữa cảnh theo trục Z
    river.castShadow = false;
    river.receiveShadow = false;
    scene.add(river);

    // Flood Plane (for overflowing water)
    const floodPlaneGeometry = new THREE.BoxGeometry(2000, 2000, 0.1); // Large plane for flood water
    const floodPlane = new THREE.Mesh(floodPlaneGeometry, riverMaterial); // Use the same river material
    floodPlane.rotation.x = -Math.PI / 2; // Rotate to be flat
    floodPlane.position.y = initialRiverY; // Start at river's initial Y
    floodPlane.position.z = 0;
    floodPlane.visible = false; // Initially hidden
    floodPlane.castShadow = false;
    floodPlane.receiveShadow = false;
    scene.add(floodPlane);

    // Function to create a mountain river segment
    const createMountainRiver = (pathPoints: THREE.Vector3[], material: THREE.ShaderMaterial) => {
      const curve = new THREE.CatmullRomCurve3(pathPoints);
      const radius = riverWidth / 4; // Bán kính của ống, có thể điều chỉnh
      const tubularSegments = 200; // Số lượng phân đoạn dọc theo đường ống
      const radialSegments = 8; // Số lượng phân đoạn xung quanh bán kính
      const closed = false; // Không đóng đường ống

      const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
      const mesh = new THREE.Mesh(geometry, material);

      return mesh;
    };

    // Create mountain river
    const mountainRiverPathPoints = [
      new THREE.Vector3(40, 150, -320), // Start point (top of the mountain)
      new THREE.Vector3(-10, 100, -320), // Intermediate point 1
      new THREE.Vector3(-10, 50, -240),  // Intermediate point 2
      new THREE.Vector3(-20, 10, -180),  // Intermediate point 3
      new THREE.Vector3(0, -25.05, -50), // Point just before merging
      new THREE.Vector3(0, -25.05, 0)   // Point merging with main river at its center Z
    ];
    const mountainRiver = createMountainRiver(mountainRiverPathPoints, mountainRiverMaterial);
    scene.add(mountainRiver);

    // Create front river
    const frontRiverGeometry = new THREE.BoxGeometry(2100, 1000, 0.1); // Make it wider to match land width
    const frontRiver = new THREE.Mesh(frontRiverGeometry, riverMaterial);
    frontRiver.rotation.x = -Math.PI / 2; // Rotate to be flat
    frontRiver.position.y = initialRiverY; // Start at river's initial Y
    frontRiver.position.z = 500; // Position it further in front
    frontRiver.castShadow = false;
    frontRiver.receiveShadow = false;
    scene.add(frontRiver);

    scene.background = new THREE.Color(0xADD8E6); // Màu nền xanh nhạt cho cảnh ban đầu




    // Load ground textures
    const groundAlbedo = textureLoader.load(
        '/textures/ground/ground_albedo.jpg',
        () => console.log('groundAlbedo loaded successfully'),
        undefined,
        (error) => console.error('Error loading groundAlbedo:', error)
    );
    const groundNormal = textureLoader.load(
        '/textures/ground/ground_normal.jpg',
        () => console.log('groundNormal loaded successfully'),
        undefined,
        (error) => console.error('Error loading groundNormal:', error)
    );
    const groundRoughness = textureLoader.load(
        '/textures/ground/ground_roughness.jpg',
        () => console.log('groundRoughness loaded successfully'),
        undefined,
        (error) => console.error('Error loading groundRoughness:', error)
    );
    const groundAO = textureLoader.load(
        '/textures/ground/ground_ao.jpg',
        () => console.log('groundAO loaded successfully'),
        undefined,
        (error) => console.error('Error loading groundAO:', error)
    );
    

    // Set texture wrapping and repeat for seamless tiling
    [groundAlbedo, groundNormal, groundRoughness, groundAO].forEach(texture => {
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(100, 100); // Adjust repeat values as needed for desired tiling
    });

    let floodLevel = -0.1; // Initial flood level (matching river's initial y position)
    const floodSpeed = 0.1; // Speed at which water rises (adjusted for smoother rise)
    let hasStartedFlooding = false; // New variable to control flood start

    const windDirection = new THREE.Vector3(1, 0, 0.5).normalize(); // Hướng gió (ví dụ: từ trái sang phải và hơi về phía trước)
    const windStrength = 5; // Cường độ gió

    let isRaining = false; // Biến trạng thái mưa

    // Initial light and background values
    const initialAmbientIntensity = 0.5;
    const initialDirectionalIntensity = 0.8;
    const initialBackgroundColor = new THREE.Color(0xADD8E6);

    // Target light and background values for rain
    const targetAmbientIntensity = 0.1;
    const targetDirectionalIntensity = 0.05;
    const targetBackgroundColor = new THREE.Color(0x111111);

    // Interpolation speed
    const darkeningSpeed = 0.01; // Điều chỉnh tốc độ làm tối cảnh

    // Cloud color transition values
    const initialCloudColor = new THREE.Color(0xFFFFFF); // Màu trắng ban đầu của mây
    const targetCloudColor = new THREE.Color(0x333333); // Màu xám đậm mục tiêu của mây

    let isDarkeningClouds = false; // Biến trạng thái làm tối mây

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Ánh sáng môi trường ban đầu sáng
    scene.add(ambientLight);

    // Add directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8); // Ánh sáng định hướng ban đầu sáng
    directionalLight.position.set(50, 100, 70); // Position the light for natural shadows
    directionalLight.castShadow = true; // Enable shadows
    scene.add(directionalLight);

    // Configure shadow properties for better quality
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 300;
    directionalLight.shadow.camera.left = -150;
    directionalLight.shadow.camera.right = 150;
    directionalLight.shadow.camera.top = 150;
    directionalLight.shadow.camera.bottom = -150;

    

    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight, // Adjusted aspect ratio to fit container
      0.1,
      1000
    );
    camera.position.set(0, 20, 50); // Set initial camera position
    camera.lookAt(0, 0, 0); // Look at the center of the scene

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const clock = new THREE.Clock(); // Khởi tạo Clock
    renderer.setSize(mount.clientWidth, mount.clientHeight); // Adjusted renderer size to fit container
    mount.appendChild(renderer.domElement);

    // Enable shadows in the renderer
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Enable smooth camera movement
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.maxPolarAngle = Math.PI / 2 - 0.1; // Limit vertical rotation (prevent looking too far down)
    controls.minPolarAngle = Math.PI / 4; // Limit vertical rotation (prevent looking too far up from horizontal)

    // Post-processing for bloom effect
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

  
    // Handle window resize
    const handleResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      composer.setSize(mount.clientWidth, mount.clientHeight);
    };

    window.addEventListener('resize', handleResize);






    // Texture Loader

    const fontLoader = new FontLoader();
    let font: Font | null = null;
    fontLoader.load(
      '/fonts/helvetiker_regular.typeface.json', // You'll need to place a font file here
      (loadedFont) => {
        font = loadedFont;
        setFontLoaded(true);
      },
      undefined,
      (error) => {
        console.error('Error loading font:', error);
      }
    );

    // Load textures for house
    const wallAlbedoTexture = textureLoader.load('/textures/wall_albedo.jpg');
    const wallNormalTexture = textureLoader.load('/textures/wall_normal.jpg');
    const roofAlbedoTexture = textureLoader.load('/textures/roof_albedo.jpg');
    const roofNormalTexture = textureLoader.load('/textures/roof_normal.jpg');
    const mountainNormalTexture = textureLoader.load('/textures/mountain_normal.jpg');
    const mountainAlbedoTexture = textureLoader.load('/textures/mountain_albedo-copy.jpg');
    const mountainRoughnessTexture = textureLoader.load('/textures/mountain_roughness.jpg');
    const mountainDisplacementTexture = textureLoader.load('/textures/mountain_displacement.jpg');
    const mountainAoTexture = textureLoader.load('/textures/mountain_ao.jpg');
    const doorAlbedoTexture = textureLoader.load('/textures/door_albedo.jpg');
    const windowAlbedoTexture = textureLoader.load('/textures/window_albedo.jpg');
    const chimneyAlbedoTexture = textureLoader.load('/textures/chimney_albedo.jpg');



    // Clouds
    
    const createComplexCloud = (cloudGeometry: THREE.SphereGeometry, cloudMaterial: THREE.MeshBasicMaterial) => {
      const cloudGroup = new THREE.Group();

      // Thêm các điểm mây nhỏ hơn để tạo hình dạng phức tạp hơn
      for (let i = 0; i < 40; i++) {
        const smallCloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
        smallCloud.position.set(
          (Math.random() - 0.5) * 60, // Vị trí ngẫu nhiên xung quanh đám mây chính
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 80
        );
        smallCloud.scale.set(
          Math.random() * 20 + 10, // Kích thước ngẫu nhiên cho các điểm mây nhỏ
          Math.random() * 8 + 4,
          Math.random() * 25 + 15
        );
        cloudGroup.add(smallCloud);
      }
      return cloudGroup;
    };

    const cloudGeometry = new THREE.SphereGeometry(1, 32, 32);
    const cloudMaterial = new THREE.MeshBasicMaterial({
        color: 0xFFFFFF, // Màu trắng cho mây ban đầu
        transparent: true,
        opacity: 0.9 // Độ mờ đục
    });

    // Create complex clouds
    for (let i = 0; i < 1200; i++) {
      const cloudGroup = createComplexCloud(cloudGeometry, cloudMaterial);
      cloudGroup.position.set(
        (Math.random() - 0.5) * 2100, // X position (increased spread)
        Math.random() * 50 + 150, // Y position (higher up)
        (Math.random() - 0.5) * 2100  // Z position (increased spread)
      );
      scene.add(cloudGroup);
      allCloudGroupsRef.current.push(cloudGroup);
    }



    const rainGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(rainCount * 3);
    const velocities = new Float32Array(rainCount * 3); // Tốc độ rơi của từng hạt mưa

    for (let i = 0; i < rainCount; i++) {
      // Vị trí ban đầu
      if (allCloudGroupsRef.current.length > 0) {
          const randomCloudGroup = allCloudGroupsRef.current[Math.floor(Math.random() * allCloudGroupsRef.current.length)];
          positions[i * 3] = randomCloudGroup.position.x + (Math.random() - 0.5) * 80; // x (trong phạm vi đám mây)
          positions[i * 3 + 1] = randomCloudGroup.position.y + (Math.random() - 0.5) * 30; // y (trong/bên dưới đám mây)
          positions[i * 3 + 2] = randomCloudGroup.position.z + (Math.random() - 0.5) * 80; // z (trong phạm vi đám mây)
        } else {
          // Thiết lập vị trí ngẫu nhiên khi chưa có đám mây
          positions[i * 3] = Math.random() * 200 - 100;
          positions[i * 3 + 1] = Math.random() * 60 + 20;
          positions[i * 3 + 2] = Math.random() * 200 - 100;
        }

      // Tốc độ rơi ngẫu nhiên
      velocities[i * 3] = 0;
      velocities[i * 3 + 1] = -3.0 - Math.random() * 2.0; // Tốc độ rơi nhanh hơn và ngẫu nhiên
      velocities[i * 3 + 2] = 0;
    }

    rainGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    rainGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

    // Tạo texture hình bầu dục cho hạt mưa (dài hơn một chút)
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext('2d');
    if (context) {
      context.beginPath();
      context.ellipse(8, 8, 3, 8, 0, 0, Math.PI * 2); // Hình bầu dục dọc
      context.fillStyle = '#ffffff';
      context.fill();
    }
    const rainTexture = new THREE.CanvasTexture(canvas);

    const rainMaterial = new THREE.PointsMaterial({
      color: 0xADD8E6, // Màu xanh nhạt
      size: 0.5, // Kích thước hạt mưa lớn hơn
      transparent: true,
      opacity: 0.8, // Độ mờ đục
      blending: THREE.AdditiveBlending, // Chế độ hòa trộn để tạo hiệu ứng sáng hơn
      map: rainTexture, // Sử dụng texture hình tròn
    });

    const rain = new THREE.Points(rainGeometry, rainMaterial);
    rain.visible = false; // Ban đầu ẩn hạt mưa
    scene.add(rain);

    startRef.current = () => {
      isDarkeningClouds = true;
      setSimStatus('running');
      setTimeout(() => {
        if (simStatusRef.current !== 'idle') {
          isRaining = true;
          rain.visible = true;
          setTimeout(() => {
            if (simStatusRef.current !== 'idle') {
              hasStartedFlooding = true;
            }
          }, 10000);
        }
      }, 3000);
    };
    pauseRef.current = () => {
      setSimStatus('paused');
    };
    resumeRef.current = () => {
      setSimStatus('running');
    };

    // Houses
    const createHouse = (x: number, y: number, z: number, color: THREE.ColorRepresentation, scale: number = 1, index: number) => {
      const houseGroup = new THREE.Group();

      // Base (Cube)
      const baseGeometry = new THREE.BoxGeometry(3 * scale, 3 * scale, 3 * scale);
      const baseMaterial = new THREE.MeshStandardMaterial({
        map: wallAlbedoTexture,
        normalMap: wallNormalTexture,
        roughness: 0.7,
        metalness: 0.1,
      });

      const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = (3 * scale) / 2; // Half of base height
      base.castShadow = true;
      base.receiveShadow = true;
      houseGroup.add(base);

      // Roof (Pyramid - more realistic than cone for a simple house)
      const roofGeometry = new THREE.ConeGeometry(2.5 * scale, 2 * scale, 4); // Still using ConeGeometry, but can be thought of as a pyramid with 4 segments
      const roofMaterial = new THREE.MeshStandardMaterial({
        map: roofAlbedoTexture,
        normalMap: roofNormalTexture,
        roughness: 0.6,
        metalness: 0.05,
      }); // Brown roof
      const roof = new THREE.Mesh(roofGeometry, roofMaterial);
      roof.position.y = 4 * scale; // Position above the base
      roof.rotation.y = Math.PI / 4; // Rotate 45 degrees to align with the base
      roof.castShadow = true;
      roof.receiveShadow = true;
      houseGroup.add(roof);

      // Door
      const doorGeometry = new THREE.BoxGeometry(1 * scale, 2 * scale, 0.1 * scale);
      const doorMaterial = new THREE.MeshStandardMaterial({
        map: doorAlbedoTexture,
        roughness: 0.8,
        metalness: 0.0,
      }); // Sienna brown door
      const door = new THREE.Mesh(doorGeometry, doorMaterial);
      door.position.set(0, 1 * scale, 1.5 * scale); // Position in front of the base
      door.castShadow = true;
      door.receiveShadow = true;
      houseGroup.add(door);

      // Window 1
      const windowGeometry = new THREE.BoxGeometry(1, 1, 0.1);
      const windowMaterial = new THREE.MeshStandardMaterial({
        map: windowAlbedoTexture,
        roughness: 0.1,
        metalness: 0.5,
        transparent: true,
        opacity: 0.8,
      }); // Sky blue glass
      const window1 = new THREE.Mesh(windowGeometry, windowMaterial);
      window1.position.set(-1, 1.5, 1.51); // Position on the side of the door
      window1.castShadow = true;
      window1.receiveShadow = true;
      houseGroup.add(window1);

      // Window 2
      const window2 = new THREE.Mesh(windowGeometry, windowMaterial);
      window2.position.set(1, 1.5, 1.51); // Position on the other side of the door
      window2.castShadow = true;
      window2.receiveShadow = true;
      houseGroup.add(window2);

      // Chimney
      const chimneyGeometry = new THREE.BoxGeometry(0.5, 1.5, 0.5);
      const chimneyMaterial = new THREE.MeshStandardMaterial({
        map: chimneyAlbedoTexture,
        roughness: 0.7,
        metalness: 0.1,
      }); // Dim gray chimney
      const chimney = new THREE.Mesh(chimneyGeometry, chimneyMaterial);
      chimney.position.set(1.5, 3.25, -1.5);
      chimney.castShadow = true;
      chimney.receiveShadow = true;
      houseGroup.add(chimney);





      houseGroup.position.set(x, y, z);

      // Add house number
      if (font) {
        const textMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 }); // Black color for text
        const textGeometry = new TextGeometry((index + 1).toString(), {
          font: font,
          size: 1,
          depth: 0.1,
        });
        textGeometry.computeBoundingBox();
        const textWidth = textGeometry.boundingBox!.max.x - textGeometry.boundingBox!.min.x;
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.set(-textWidth / 2, 5 * scale, 0); // Position above the house
        textMesh.rotation.y = -Math.PI / 2; // Rotate to face the camera
        houseGroup.add(textMesh);
      }

      return houseGroup;
    };

    const getHousePlacement = (houseX: number, houseZ: number, roadFixedCoord: number, roadAxis: 'x' | 'z', scale: number, offsetFromRoad: number) => {
      let rotationY = 0;
      let finalHouseX = houseX;
      let finalHouseZ = houseZ;
      const gardenHalfSize = 4 * scale;
      const roadHalfWidth = 1; // Assuming roadWidth = 2 for the branch road

      if (roadAxis === 'z') { // Road runs along Z-axis, fixed X-coordinate is roadFixedCoord
        if (houseX < roadFixedCoord) { // House is to the left of the road
          rotationY = Math.PI / 2; // Door faces world +X
          finalHouseX = (roadFixedCoord + roadHalfWidth) - gardenHalfSize - offsetFromRoad;
        } else if (houseX > roadFixedCoord) { // House is to the right of the road
          rotationY = -Math.PI / 2; // Door faces world -X
          finalHouseX = (roadFixedCoord - roadHalfWidth) + gardenHalfSize + offsetFromRoad;
        }
      } else { // roadAxis === 'x', Road runs along X-axis, fixed Z-coordinate is roadFixedCoord
        if (houseZ < roadFixedCoord) { // House is in front of the road
          rotationY = 0; // Door faces world +Z
          finalHouseZ = (roadFixedCoord + roadHalfWidth) - gardenHalfSize - offsetFromRoad;
        } else if (houseZ > roadFixedCoord) { // House is behind the road
          rotationY = Math.PI; // Door faces world -Z
          finalHouseZ = (roadFixedCoord - roadHalfWidth) + gardenHalfSize + offsetFromRoad;
        }
      }

      return { x: finalHouseX, z: finalHouseZ, rotationY };
    };

    // Function to create a tree
    const createTree = (x: number, y: number, z: number, scale: number = 0.5) => {
      const treeGroup = new THREE.Group();

      // Trunk (Cylinder)
      const trunkGeometry = new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, 3 * scale, 8);
      const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x5C4033 }); // Darker Brown
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = (3 * scale) / 2; // Half of trunk height
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      // Leaves (Sphere)
      const leavesGeometry = new THREE.SphereGeometry(2 * scale, 16, 16);
      const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x2E8B57, roughness: 0.8, metalness: 0.0 }); // Sea Green
      const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
      leaves.position.y = 4 * scale; // Above the trunk
      leaves.castShadow = true;
      leaves.receiveShadow = true;
      treeGroup.add(leaves);

      treeGroup.position.set(x, y, z);
      return treeGroup;
    };

    // Function to create a mountain
    const createMountain = (x: number, y: number, z: number, scale: number) => {
      const mountainGroup = new THREE.Group();

      const mountainGeometry = new THREE.ConeGeometry(scale * 20, scale * 15, 32); // Base radius, height, segments
      const mountainMaterial = new THREE.MeshStandardMaterial({
        map: mountainAlbedoTexture, // Bản đồ màu cơ bản
        normalMap: mountainNormalTexture, // Bản đồ pháp tuyến
        roughnessMap: mountainRoughnessTexture, // Bản đồ độ nhám
        displacementMap: mountainDisplacementTexture, // Bản đồ dịch chuyển
        aoMap: mountainAoTexture, // Bản đồ che khuất môi trường
        displacementScale: 10, // Điều chỉnh cường độ dịch chuyển (cần thử nghiệm)
        color: 0xFFFFFF, // Đặt màu trắng nếu dùng albedo map để texture quyết định màu
        roughness: 1, // Đặt về 1 nếu dùng roughness map
        metalness: 0.05, // Giảm độ kim loại
      });
      const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial);
      mountain.position.y = y + (scale * 15) / 2; // Position based on height
      mountain.castShadow = true;
      mountain.receiveShadow = true;
      mountainGroup.add(mountain);

      mountainGroup.position.set(x, y, z);
      mountainGroup.userData.initialY = y; // Store initial Y position
      return mountainGroup;
    };



    // Function to create a river
    const createRiver = (width: number, length: number, x: number, y: number, z: number, rotationY: number = 0) => {
      const riverGeometry = new THREE.PlaneGeometry(width, length);
      const riverMaterial = new THREE.MeshStandardMaterial({ color: 0x0077be, transparent: true, opacity: 0.8 }); // Blue for river
      const river = new THREE.Mesh(riverGeometry, riverMaterial);
      river.rotation.x = -Math.PI / 2; // Rotate to be flat on the ground
      river.rotation.y = rotationY; // Rotate around Y-axis for direction
      river.position.set(x, y, z);
      river.receiveShadow = true;
      return river;
    };

    const houseColors = [
      0x8B4513, // SaddleBrown
      0xA0522D, // Sienna
      0xD2B48C, // Tan
      0xF5DEB3, // Wheat
      0xBC8F8F, // RosyBrown
      0xCD853F, // Peru
      0xF4A460, // SandyBrown
      0xDAA520, // Goldenrod
      0xB0C4DE, // LightSteelBlue
      0x87CEEB, // SkyBlue
      0xADD8E6, // LightBlue
      0x98FB98, // PaleGreen
      0x3CB371, // MediumSeaGreen
      0x6B8E23, // OliveDrab
      0x556B2F, // DarkOliveGreen
      0x708090, // SlateGray
      0x778899, // LightSlateGray
      0x696969, // DimGray
    ];


    
    cityGroups.forEach(cityGroup => {
      const numberOfHousesPerGroup = 25; // 50 total houses / 2 city groups
      const housePositions: { x: number; y: number; z: number }[] = [];

      // Define local min/max for houses relative to cityGroup's center
      // Ensure houses are not near the river (river is from -50 to 50)
      // cityGroup.position.x is 150 or -150
      // If cityGroup.position.x is 150, localX should be -100 to 100 (absolute 50 to 250)
      // If cityGroup.position.x is -150, localX should be -100 to 100 (absolute -250 to -50)
      const localMinX = -100;
      const localMaxX = 100;
      const localMinZ = -50; // Relative to cityGroup.position.z
      const localMaxZ = 200; // Relative to cityGroup.position.z
      const localMinY = 5; // Đặt nhà và cây trên mặt đất liền (bờ sông)
      const localMaxY = 5; // Đặt nhà và cây trên mặt đất liền (bờ sông)

      const houseSize = 30; // Kích thước ước tính của một ngôi nhà (bao gồm cả khoảng trống xung quanh)
      const maxAttempts = 100; // Số lần thử tối đa để tìm vị trí cho một ngôi nhà

      for (let i = 0; i < numberOfHousesPerGroup; i++) {
        let attempts = 0;
        let newX, newZ;
        let positionFound = false;

        while (attempts < maxAttempts && !positionFound) {
          newX = localMinX + Math.random() * (localMaxX - localMinX);
          newZ = localMinZ + Math.random() * (localMaxZ - localMinZ);

          // Kiểm tra chồng chéo với các ngôi nhà đã có
          let isOverlapping = false;
          for (const existingPos of housePositions) {
            const distance = Math.sqrt(
              Math.pow(newX - existingPos.x, 2) + Math.pow(newZ - existingPos.z, 2)
            );
            if (distance < houseSize) { // Nếu khoảng cách nhỏ hơn kích thước nhà, có chồng chéo
              isOverlapping = true;
              break;
            }
          }

          // Kiểm tra không lấn vào sông
          // riverHalfWidth và minDistanceFromRiver đã được định nghĩa ở trên
          const absoluteX = cityGroup.position.x + newX; // Vị trí X tuyệt đối của ngôi nhà
          const riverLeftEdge = -riverHalfWidth - minDistanceFromRiver;
          const riverRightEdge = riverHalfWidth + minDistanceFromRiver;

          if (absoluteX > riverLeftEdge && absoluteX < riverRightEdge) {
            isOverlapping = true; // Ngôi nhà lấn vào khu vực sông
          }

          if (!isOverlapping) {
            housePositions.push({ x: newX, y: localMinY, z: newZ });
            positionFound = true;
          }
          attempts++;
        }

        if (!positionFound) {
          console.warn(`Could not find a non-overlapping position for house ${i + 1} after ${maxAttempts} attempts.`);
        }
      }



      

      housePositions.forEach((pos, index) => {
          const house = createHouse(pos.x, pos.y, pos.z, houseColors[index % houseColors.length], 3, index);
          cityGroup.add(house);

          // Add a tree next to each house
          const tree = createTree(pos.x + 5, 5, pos.z + 5, 2); // Adjust position relative to the house
          cityGroup.add(tree);
        });
    });



    const mountainGroups: THREE.Group[] = [];

 

    // Create elevated river banks
    const bankWidth = 1000; // Chiều rộng của bờ sông (tăng lên để phủ hết cảnh)
    const bankLength = 2000; // Chiều dài của bờ sông (tương tự sông)
    const bankHeight = 5; // Chiều cao của bờ sông (độ dày)
    const bankMaterial = new THREE.MeshStandardMaterial({
        map: groundAlbedo,
        normalMap: groundNormal,
        roughnessMap: groundRoughness,
        aoMap: groundAO,
    });

    // Left bank
    const leftBankGeometry = new THREE.BoxGeometry(bankWidth, bankHeight, bankLength, 100, 10, 100); // BoxGeometry with segments
    const leftBank = new THREE.Mesh(leftBankGeometry, bankMaterial);
    leftBank.position.set(-550, bankHeight / 2, -500); // Đặt bên trái sông, mép phải ở -50
    leftBank.receiveShadow = true;
    scene.add(leftBank);

    // Right bank
    const rightBankGeometry = new THREE.BoxGeometry(bankWidth, bankHeight, bankLength, 100, 10, 100); // BoxGeometry with segments
    const rightBank = new THREE.Mesh(rightBankGeometry, bankMaterial);
    rightBank.position.set(550, bankHeight / 2, -500); // Đặt bên phải sông, mép trái ở 50
    rightBank.receiveShadow = true;
    scene.add(rightBank);

    // Fixed mountains
    const mountain1 = createMountain(-200, 0, -600, 18);
    scene.add(mountain1);
    mountainGroups.push(mountain1);
    const mountain2 = createMountain(800, 0, -300, 25);
    scene.add(mountain2);
    mountainGroups.push(mountain2);
    const mountain3 = createMountain(100, 0, -400, 15);
    scene.add(mountain3);
    mountainGroups.push(mountain3);
    const mountain4 = createMountain(-800, 0, -300, 25);
      scene.add(mountain4);
      mountainGroups.push(mountain4);

      // New mountains to cover the back
      const mountain5 = createMountain(500, 0, -1600, 35);
      scene.add(mountain5);
      mountainGroups.push(mountain5);

      const mountain6 = createMountain(700, 0, -1650, 32);
      scene.add(mountain6);
      mountainGroups.push(mountain6);

      const mountain7 = createMountain(-770, 0, -1700, 38);
      scene.add(mountain7);
      mountainGroups.push(mountain7);

      const mountain8 = createMountain(900, 0, -1750, 27);
      scene.add(mountain8);
      mountainGroups.push(mountain8);

      const mountain9 = createMountain(100, 0, -1200, 30);
      scene.add(mountain9);
      mountainGroups.push(mountain9);

      const mountain10 = createMountain(-300, 0, -1300, 25);
      scene.add(mountain10);
      mountainGroups.push(mountain10);

      const mountain11 = createMountain(600, 0, -1150, 33);
      scene.add(mountain11);
      mountainGroups.push(mountain11);

      const mountain12 = createMountain(-800, 0, -1250, 28);
      scene.add(mountain12);
      mountainGroups.push(mountain12);







  
    camera.position.z = 50;
    camera.position.y = 1;
    camera.lookAt(0, -5, -100);

    // Lightning setup


    const lightningMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF, // White color for lightning
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });

    const lightningStrike = new LightningStrike({
      sourceOffset: new THREE.Vector3(0, 0, 0),
      destOffset: new THREE.Vector3(0, 0, 0),
      roughness: 0.8, // Slightly less rough
      straightness: 0.6, // Slightly less straight
      ramification: 7, // More ramifications
      recursionProbability: 0.7, // Higher probability of recursion
      maxIterations: 10, // More iterations for finer detail
      maxSubrayRecursion: 4, // Deeper recursion

      // isStatic: true, // Set to true if the lightning doesn't change over time
    });
    const lightningMesh = new THREE.Mesh(lightningStrike, lightningMaterial);
    lightningMesh.visible = false; // Hide initially, will be shown when lightning strikes
    scene.add(lightningMesh);

    // Lightning PointLight for shadows
    const lightningPointLight = new THREE.PointLight(0xFFFFFF, 1000, 500);
    lightningPointLight.castShadow = true;
    lightningPointLight.shadow.mapSize.width = 1024;
    lightningPointLight.shadow.mapSize.height = 1024;
    lightningPointLight.shadow.camera.near = 0.1;
    lightningPointLight.shadow.camera.far = 500;
    lightningPointLight.visible = false; // Hide initially
    scene.add(lightningPointLight);

    let lightningTimer = 0;
    const lightningInterval = 500; // milliseconds
    const lightningDuration = 200; // milliseconds



    const animate = () => {
        const delta = clock.getDelta(); // Lấy thời gian chênh lệch giữa các khung hình
        const elapsedTime = clock.getElapsedTime();
        const isRunning = simStatusRef.current === 'running';
        const isPaused = simStatusRef.current === 'paused';

        if (!isPaused) {
          if (isDarkeningClouds) {
            ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, targetAmbientIntensity, darkeningSpeed);
            directionalLight.intensity = THREE.MathUtils.lerp(directionalLight.intensity, targetDirectionalIntensity, darkeningSpeed);
            directionalLight.castShadow = false; // Tắt đổ bóng khi trời tối
            if (scene.background instanceof THREE.Color) {
              scene.background.lerp(targetBackgroundColor, darkeningSpeed);
            }
            cloudMaterial.color.lerp(targetCloudColor, darkeningSpeed);
          } else {
            ambientLight.intensity = THREE.MathUtils.lerp(ambientLight.intensity, initialAmbientIntensity, darkeningSpeed);
            directionalLight.intensity = THREE.MathUtils.lerp(directionalLight.intensity, initialDirectionalIntensity, darkeningSpeed);
            directionalLight.castShadow = true; // Bật đổ bóng khi trời sáng
            if (scene.background instanceof THREE.Color) {
              scene.background.lerp(initialBackgroundColor, darkeningSpeed);
            }
            cloudMaterial.color.lerp(initialCloudColor, darkeningSpeed);
          }
        }

      riverMaterial.uniforms.time.value = elapsedTime;
      riverMaterial.uniforms.floodLevel.value = floodLevel;
      mountainRiverMaterial.uniforms.time.value = elapsedTime;
      mountainRiverMaterial.uniforms.floodLevel.value = floodLevel; // Update floodLevel uniform


        mountainRiverMaterial.uniforms.floodLevel.value = floodLevel;

        // // Update water shader time uniform for wave animation
        // if (waterMaterial.uniforms) {
        //   waterMaterial.uniforms.time.value += delta; // Cập nhật thời gian cho hiệu ứng sóng
        // }



      if (isRaining && isRunning) {
        const positions = rain.geometry.attributes.position.array as Float32Array;
        const velocities = rain.geometry.attributes.velocity.array as Float32Array;

        for (let i = 0; i < rainCount; i++) {
          positions[i * 3] += windDirection.x * windStrength * 0.5; // Thêm gió
          positions[i * 3 + 1] += velocities[i * 3 + 1]; // Cập nhật vị trí Y theo vận tốc
          positions[i * 3 + 2] += windDirection.z * windStrength * 0.5; // Thêm gió

          // Nếu hạt mưa rơi xuống dưới một ngưỡng nhất định, đưa nó trở lại đỉnh
          if (positions[i * 3 + 1] < -20) {
            if (allCloudGroupsRef.current.length > 0) {
              const randomCloudGroup = allCloudGroupsRef.current[Math.floor(Math.random() * allCloudGroupsRef.current.length)];
              positions[i * 3] = randomCloudGroup.position.x + (Math.random() - 0.5) * 80;
              positions[i * 3 + 1] = randomCloudGroup.position.y + (Math.random() - 0.5) * 30;
              positions[i * 3 + 2] = randomCloudGroup.position.z + (Math.random() - 0.5) * 80;
            } else {
              // Fallback if no clouds are present (shouldn't happen if clouds are created)
              positions[i * 3] = Math.random() * 100 - 50;
              positions[i * 3 + 1] = Math.random() * 60 + 20;
              positions[i * 3 + 2] = Math.random() * 100 - 50;
            }
          }
        }
        rain.geometry.attributes.position.needsUpdate = true;
      }

      if (hasStartedFlooding && isRunning) {
          floodLevel += floodSpeed * delta;
          const currentRiverDepth = initialRiverDepth + (floodLevel - initialRiverY);
          river.scale.z = currentRiverDepth / initialRiverDepth;
          river.position.y = floodLevel - (currentRiverDepth / 2);
          // Điều chỉnh cường độ dòng chảy của sông chính
          const bankHeight = 5; // Chiều cao của bờ sông
          if (floodLevel >= bankHeight) {
            riverMaterial.uniforms.flowIntensity.value = 0.0; // Dừng chảy khi nước lũ lên đến bờ
          } else {
            riverMaterial.uniforms.flowIntensity.value = 1.0; // Tiếp tục chảy bình thường
          }
          // Update floodPlane
            if (floodLevel > initialRiverY + 0.5) { // Show floodPlane when water level is above initial river level
              floodPlane.visible = true;
              // Calculate current flood plane depth based on floodLevel
              const currentFloodPlaneDepth = initialRiverDepth + (floodLevel - initialRiverY);
              
              // Set floodPlane's Y position to the current floodLevel
              floodPlane.position.y = floodLevel;

              // Calculate floodPlane's Z scale (depth)
              // We want the floodPlane to represent the water surface, so its depth should be 0.1 (initialRiverDepth)
              // and its position should be at floodLevel.
              // The BoxGeometry for floodPlane has a height of 0.1, so we don't need to scale Z for depth.
              // Instead, we ensure its Y position is correct.
              // floodPlane.scale.z = currentFloodPlaneDepth / initialRiverDepth; // This was for vertical scaling, no longer needed for depth

              // Calculate floodPlane's X scale (width) for gradual overflow
              const bankHeight = 5; // Chiều cao của bờ sông
              const riverWidth = 100; // Chiều rộng của sông
              const maxFloodPlaneWidth = 2000; // Chiều rộng tối đa của floodPlane (đã định nghĩa trong BoxGeometry)

              if (floodLevel < bankHeight) {
                // Giai đoạn 1: Nước trong lòng sông, chưa tràn bờ
                floodPlane.scale.x = riverWidth; // Giữ nguyên chiều rộng sông
              } else {
                // Giai đoạn 2 & 3: Nước bắt đầu tràn bờ và bao phủ đất liền
                // Tính toán tỷ lệ mở rộng dựa trên mức nước vượt qua bờ
                const overflowAmount = floodLevel - bankHeight;
                // Tăng chiều rộng từ riverWidth đến maxFloodPlaneWidth khi nước tràn qua bờ
                // Sử dụng một hàm tuyến tính hoặc hàm mượt hơn để điều khiển sự mở rộng
                // Ví dụ: mở rộng 100 đơn vị chiều rộng cho mỗi 1 đơn vị chiều cao nước tràn
                const expansionFactor = 100; 
                const targetWidth = riverWidth + overflowAmount * expansionFactor;
                floodPlane.scale.x = Math.min(targetWidth, maxFloodPlaneWidth);
              }
            }

            // Update frontRiver for flood
            const currentFrontRiverDepth = initialRiverDepth + (floodLevel - initialRiverY);
            // frontRiver.scale.z = currentFrontRiverDepth / initialRiverDepth; // No longer needed for depth scaling
            frontRiver.position.y = floodLevel; // Set frontRiver's Y position to the current floodLevel

            // Calculate frontRiver's X scale (width) for gradual overflow
            // const bankHeight = 5; // Chiều cao của bờ sông

            const riverWidth = 100; // Chiều rộng của sông
            const maxFloodPlaneWidth = 2100; // Chiều rộng tối đa của frontRiver (đã định nghĩa trong BoxGeometry)

            if (floodLevel < bankHeight) {
              // Giai đoạn 1: Nước trong lòng sông, chưa tràn bờ
              frontRiver.scale.x = riverWidth; // Giữ nguyên chiều rộng sông
            } else {
              // Giai đoạn 2 & 3: Nước bắt đầu tràn bờ và bao phủ đất liền
              const overflowAmount = floodLevel - bankHeight;
              const expansionFactor = 100; 
              const targetWidth = riverWidth + overflowAmount * expansionFactor;
              frontRiver.scale.x = Math.min(targetWidth, maxFloodPlaneWidth);
            }

        }

      // Lightning animation
      lightningTimer += 16; // Assuming 60fps, roughly 16ms per frame
      if (isRaining && isRunning && lightningTimer > lightningInterval && allCloudGroupsRef.current.length > 0) {
          const randomCloudGroup = allCloudGroupsRef.current[Math.floor(Math.random() * allCloudGroupsRef.current.length)];
          const sourceOffset = new THREE.Vector3(
            randomCloudGroup.position.x + (Math.random() - 0.5) * 50,
            randomCloudGroup.position.y + (Math.random() - 0.5) * 10,
            randomCloudGroup.position.z + (Math.random() - 0.5) * 70
          );
        const destOffset = new THREE.Vector3(
          Math.random() * 80 - 40,
          Math.random() * 5 - 5, // Sét đánh xuống gần mặt đất
          Math.random() * 80 - 40
        );

        lightningStrike.rayParameters.sourceOffset.copy(sourceOffset);
        lightningStrike.rayParameters.destOffset.copy(destOffset);

        const currentTime = performance.now() / 1000;
        lightningStrike.rayParameters.birthTime = currentTime;

        lightningStrike.rayParameters.deathTime = currentTime + lightningDuration / 1000;
        lightningStrike.update(lightningStrike.rayParameters.birthTime);
        lightningMesh.visible = true; // Show lightning after update
        lightningPointLight.position.copy(destOffset); // Set light position to lightning destination
        lightningPointLight.visible = true; // Show lightning light

        setTimeout(() => {
          lightningMesh.visible = false;
          lightningPointLight.visible = false; // Hide lightning light
        }, lightningDuration);
        lightningTimer = 0; // Reset timer
      }

      // Mountain animation
      mountainGroups.forEach(mountain => {
        const initialY = mountain.userData.initialY;
        mountain.position.y = initialY + (Math.sin(performance.now() * 0.0005 + mountain.uuid.charCodeAt(0)) * 0.5 + 0.5); // Subtle up and down movement, always above initialY
      });

      // Update controls
      controls.update();

      composer.render();
      requestAnimationFrame(animate);
    };

    animate();

    resetRef.current = () => {
      setSimStatus('idle');
      isDarkeningClouds = false;
      isRaining = false;
      hasStartedFlooding = false;
      rain.visible = false;
      floodLevel = initialRiverY;
      river.scale.z = 1;
      river.position.y = initialRiverY - (initialRiverDepth / 2);
      floodPlane.visible = false;
      floodPlane.scale.z = 1;
      floodPlane.position.y = initialRiverY - (initialRiverDepth / 2);
      frontRiver.scale.z = 1;
      frontRiver.position.y = initialRiverY - (initialRiverDepth / 2);
      ambientLight.intensity = initialAmbientIntensity;
      directionalLight.intensity = initialDirectionalIntensity;
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(initialBackgroundColor);
      } else {
        scene.background = initialBackgroundColor.clone();
      }
      cloudMaterial.color.copy(initialCloudColor);
      lightningMesh.visible = false;
    };

    return () => {
      mount.removeChild(renderer.domElement);
      window.removeEventListener('resize', handleResize);
      controls.dispose(); // Dispose of OrbitControls
    };
  }, [allCloudGroupsRef]);

  return (
    <div
      ref={mountRef}
      style={{ position: "relative", width: "100%", height: "100vh", background: "lightblue" }}
    >
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          display: "flex",
          gap: 12,
          zIndex: 10,
        }}
      >
        <button
          onClick={() => {
            if (simStatus === 'idle') startRef.current();
            else if (simStatus === 'running') pauseRef.current();
            else resumeRef.current();
          }}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #000000ff",
            background: "#ffffffaa",
            cursor: "pointer",
            color: "#000000ff",
          }}
        >
          {simStatus === 'idle' ? 'Bắt đầu' : simStatus === 'running' ? 'Tạm dừng' : 'Tiếp tục'}
        </button>
        <button
          onClick={() => resetRef.current()}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #000000ff",
            background: "#ffffffaa",
            cursor: "pointer",
            color: "#000000ff",
          }}
        >
          Quay lại
        </button>
      </div>
    </div>
  );
}
