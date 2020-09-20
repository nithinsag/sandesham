import { Router } from "express";

export function registerExtraRoutes(
  router: Router,
  baserUri: string,
  routes: [any]
) {
    console.log("registering routes", routes)
  routes.forEach((route) => {
      console.log(route)
    if (route.method == "GET") {
      router.get(`${baserUri}/${route.path}`, route.handler);
    }
    if (route.method == "POST") {
      console.log(route, `${baserUri}/${route.path}`);

      router.post(`${baserUri}/${route.path}`, route.handler);
    }
  });
}
