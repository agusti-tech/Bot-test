import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Page not found
      </p>
      <Link href="/en">
        <Button>Go Home</Button>
      </Link>
    </div>
  );
}
