import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// Render an animated blue-and-gold shader plane that fills the viewport.
export default function LiquidShader() {
    const meshRef = useRef();
    const clock = new THREE.Clock();

    useFrame(() => {
        // Update the shader time uniform for the current animation frame.
        const time = clock.getElapsedTime();
        if (meshRef.current) {
            meshRef.current.material.uniforms.uTime.value = time;
        }
    });

    useEffect(() => {
        // Size the shader plane and subscribe to viewport resize events.
        // Scale the plane and update shader resolution to cover the viewport.
        const handleResize = () => {
            if (meshRef.current) {
                const aspect = window.innerWidth / window.innerHeight;
                const scaleX = aspect > 1 ? aspect : 1;
                const scaleY = aspect > 1 ? 1 : 1 / aspect;

                // Scale the plane to ensure no whitespace
                meshRef.current.scale.set(scaleX * 3, scaleY * 3, 1);

                meshRef.current.material.uniforms.uResolution.value.set(
                    window.innerWidth,
                    window.innerHeight
                );
            }
        };

        handleResize();
        window.addEventListener("resize", handleResize);
        return /* Remove the viewport resize listener when the shader unmounts. */ () => window.removeEventListener("resize", handleResize);
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
                            new THREE.Color("#0033A0"),
                            new THREE.Color("#FFD700"),
                            new THREE.Color("#FFD700"),
                            new THREE.Color("#0033A0"),
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
}
