import { COPY } from "@capsule/config";
import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import { OverviewPage } from "./routes/index.tsx";
import { OnboardingPage } from "./routes/onboarding.tsx";
import { PlacementPage } from "./routes/placement.tsx";
import { ProvidersPage } from "./routes/providers.tsx";

function SettingsShell() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 pt-10">
        <h1 className="text-lg font-semibold">{COPY.settings}</h1>
        <nav className="flex gap-3 text-sm">
          <a href="#/" className="text-neutral-600 hover:text-black">
            Overview
          </a>
          <a href="#/placement" className="text-neutral-600 hover:text-black">
            {COPY.placement}
          </a>
          <a href="#/providers" className="text-neutral-600 hover:text-black">
            {COPY.providers}
          </a>
        </nav>
      </header>
      <main className="px-6 py-5">
        <Outlet />
      </main>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: SettingsShell,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: OverviewPage,
});

const placementRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/placement",
  component: PlacementPage,
});

const providersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/providers",
  component: ProvidersPage,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  component: OnboardingPage,
});

export const settingsRouter = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    placementRoute,
    providersRoute,
    onboardingRoute,
  ]),
  history: createHashHistory(),
});
