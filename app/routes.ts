import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/dosbox.tsx"),
  route("api/upload", "routes/api.upload.ts"),
  route("api/bundle", "routes/api.bundle.ts"),
  route("api/folders", "routes/api.folders.ts"),
  route("api/apply", "routes/api.apply.ts"),
] satisfies RouteConfig;
