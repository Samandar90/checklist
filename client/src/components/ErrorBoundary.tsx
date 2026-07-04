import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Root-level safety net. Without this, an uncaught render error anywhere in
 * the tree unmounts the entire React app (React 18 default), leaving users
 * looking at a blank page with no way back except a hard refresh.
 */
export default class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // eslint-disable-next-line no-console
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
          <h1 className="text-lg font-semibold text-foreground">Что-то пошло не так</h1>
          <p className="max-w-md text-sm text-muted-foreground">{this.state.error.message}</p>
          <Button onClick={() => (window.location.href = "/")}>На главную</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
