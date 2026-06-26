import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <h1 className="text-4xl font-semibold text-foreground">404</h1>
      <p className="text-sm text-muted-foreground">Такая страница не существует.</p>
      <Button asChild>
        <Link to="/">На дашборд</Link>
      </Button>
    </div>
  );
}
