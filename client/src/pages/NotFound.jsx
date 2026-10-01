import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

const LiquidShader = () => {

    const meshRef = useRef();
    const clock = new THREE.Clock();

    useFrame(() => {
        const time = clock.getElapsedTime();
        if (meshRef.current) {
            meshRef.current.material.uniforms.uTime.value = time;
        }
    });

    useEffect(() => {
        const handleResize = () => {
            if (meshRef.current) {
                const aspect = window.innerWidth / window.innerHeight;
                const scaleX = aspect > 1 ? aspect : 1;
                const scaleY = aspect > 1 ? 1 : 1 / aspect;

                // Scale the plane to ensure no whitespace
                meshRef.current.scale.set(scaleX * 3, scaleY * 3, 1);

                // Update resolution uniform
                meshRef.current.material.uniforms.uResolution.value.set(
                    window.innerWidth,
                    window.innerHeight
                );
            }
        };

        handleResize(); // Initial resize
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <mesh ref={meshRef}>
            {/* Plane large enough to cover all screen sizes */}
            <planeGeometry args={[1, 1, 64, 64]} />
            <shaderMaterial
                uniforms={{
                    uTime: { value: 0 },
                    uResolution: {
                        value: new THREE.Vector2(window.innerWidth, window.innerHeight),
                    },
                    uColors: {
                        value: [
                            new THREE.Color("#0033A0"), // Blue (AKPsi)
                            new THREE.Color("#FFD700"), // Gold (AKPsi)
                            new THREE.Color("#FFD700"), // Reinforce Gold
                            new THREE.Color("#0033A0"), // Reinforce Blue
                        ],
                    },
                }}
                vertexShader={`
                    uniform float uTime;
                    varying vec2 vUv;

                    void main() {
                        vUv = uv;
                        vec3 transformed = position;

                        // Add randomness to the waves
                        transformed.z += sin(uv.x * 2.0 + uTime * 1.5) * 0.2;
                        transformed.z += cos(uv.y * 2.0 + uTime * 1.0) * 0.2;
                        transformed.z += sin(uv.x * 2.0 + uTime * 0.5) * 0.1;

                        gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
                    }
                `}
                fragmentShader={`
                    uniform vec3 uColors[4]; // Array of colors (blue and gold focus)
                    uniform float uTime;
                    varying vec2 vUv;

                    void main() {
                        // Blend between blue and gold with emphasis on gold
                        vec3 color = mix(uColors[0], uColors[1], sin(vUv.y * 5.0 + uTime * 0.3) * 0.5 + 0.5);
                        color = mix(color, uColors[2], cos(vUv.x * 5.0 + uTime * 0.5) * 0.7 + 0.3); // More gold
                        color = mix(color, uColors[3], sin(vUv.y * 10.0 + uTime * 0.7) * 0.2 + 0.8); // Reinforce blue

                        gl_FragColor = vec4(color, 1.0);
                    }
                `}
                side={THREE.DoubleSide}
                transparent={true}
            />
        </mesh>
    );
};

/**
 * Not Found Summary:
 * - Removes unused inputs while keeping the shader and overlay structure.
 * - Keeps the visible message and Go Back navigation unchanged.
 */
export default function NotFound() {

    const navigate = useNavigate()

    return (

        <div className="relative w-full h-screen overflow-hidden bg-gradient-to-r from-blue-800 via-yellow-00 to-blue-800">
            {/* Fullscreen Canvas */}
            <Canvas
                camera={{
                    position: [0, 0, 1], // Adjusted camera for fullscreen plane
                }}
                className="absolute top-0 left-0 w-full h-full"
            >
                <LiquidShader />
            </Canvas>

            {/* Content Overlay */}
            <div className="absolute text-center inset-0 flex flex-col items-center justify-center z-10">
                <div className="flex items-center justify-center w-28 h-28 bg-red-500 rounded-full border-4 border-white">
                    <svg
                        className="w-16 h-16 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </div>

                {/* Title */}
                <h1 className="text-3xl font-bold text-white mt-6 text-center">404</h1>

                {/* Description */}
                <p className="text-lg text-white mt-3 text-center max-w-xl">Sorry, we {"couldn't"} find this page!</p>

                <button onClick={() => {
                    navigate("/")
                }} className="mt-3 px-6 py-3 bg-orange-300 text-white font-semibold rounded-lg shadow-md hover:bg-orange-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2">
                    Go Back
                </button>

            </div>
        </div>

    );
}
