/// <reference types="vite/client" />

declare module "*.glb?url" {
  const value: string;
  export default value;
}

declare module "*.glb" {
  const value: string;
  export default value;
}

declare module "*.gltf" {
  const value: string;
  export default value;
}
