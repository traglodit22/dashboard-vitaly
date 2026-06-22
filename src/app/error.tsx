"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-semibold">Что-то пошло не так</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Сервер временно недоступен. Если вы только что обновили страницу во время деплоя —
        подождите минуту и попробуйте снова.
      </p>
      <Button type="button" onClick={() => reset()}>
        Повторить
      </Button>
    </div>
  );
}
