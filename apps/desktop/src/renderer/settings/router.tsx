import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { Sidebar } from "./components/sidebar.tsx";
import { GeneralPage } from "./routes/general.tsx";
import { AppearancePage } from "./routes/index.tsx";
import { OnboardingPage } from "./routes/onboarding.tsx";
import { ProvidersPage } from "./routes/providers.tsx";
import { UpdatesPage } from "./routes/updates.tsx";
import { useUpdateState } from "./use-update.ts";

function SettingsShell() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const update = useUpdateState();

  return (
    <div className="flex h-full">
      <Sidebar path={path} update={update} />
      <main className="flex-1 overflow-y-auto bg-shell-base">
        {/* Clears the traffic lights and gives the content column its own
            draggable strip, so the window can be moved from either side. */}
        <div className="drag-region h-[46px]" />
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-8 pb-12">
          <Outlet />
        </div>
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
  component: AppearancePage,
});

const providersRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/providers",
  component: ProvidersPage,
});

const updatesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/updates",
  component: UpdatesPage,
});

const generalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/general",
  component: GeneralPage,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/onboarding",
  component: OnboardingPage,
});

export const settingsRouter = createRouter({
  routeTree: rootRoute.addChildren([
    indexRoute,
    providersRoute,
    updatesRoute,
    generalRoute,
    onboardingRoute,
  ]),
  history: createHashHistory(),
});
