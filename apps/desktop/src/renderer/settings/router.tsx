import { APP_NAME, COPY } from "@capsule/config";
import { cn } from "@capsule/ui";
import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { GeneralPage } from "./routes/general.tsx";
import { AppearancePage } from "./routes/index.tsx";
import { OnboardingPage } from "./routes/onboarding.tsx";
import { ProvidersPage } from "./routes/providers.tsx";

const NAV = [
  { to: "/", label: COPY.appearance },
  { to: "/providers", label: COPY.providers },
  { to: "/general", label: COPY.general },
] as const;

function SettingsShell() {
  const path = useRouterState({ select: (state) => state.location.pathname });

  return (
    <div className="flex h-full">
      <aside className="drag-region flex w-52 shrink-0 flex-col border-r border-shell-line bg-shell-panel/60 px-3 pt-11 pb-4">
        <div className="px-3 pb-5">
          <div className="text-sm font-semibold">{APP_NAME}</div>
          <div className="text-xs text-shell-muted">{COPY.settings}</div>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors",
                path === item.to
                  ? "bg-shell-raised font-medium text-shell-text"
                  : "text-shell-muted hover:bg-shell-raised/60 hover:text-shell-text",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="drag-region h-11" />
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-7 pb-10">
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
    generalRoute,
    onboardingRoute,
  ]),
  history: createHashHistory(),
});
