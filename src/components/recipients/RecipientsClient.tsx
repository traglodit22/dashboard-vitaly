"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, Pencil, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecipientForm } from "./RecipientForm";
import { EditRecipientDialog } from "./EditRecipientDialog";
import { apiFetch } from "@/lib/apiFetch";
import type { Recipient } from "@/types";

async function fetchRecipients(): Promise<Recipient[]> {
  const res = await apiFetch("/api/recipients", { cache: "no-store" });
  const data = await res.json();
  return data.recipients ?? [];
}

export function RecipientsClient() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Recipient | null>(null);

  const load = useCallback(async () => {
    setRecipients(await fetchRecipients());
  }, []);

  useEffect(() => {
    let active = true;
    fetchRecipients().then((r) => {
      if (active) {
        setRecipients(r);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  async function remove(id: string, who: string) {
    const res = await apiFetch(`/api/recipients/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Получатель удалён", { description: who });
      load();
    } else {
      toast.error("Не удалось удалить");
    }
  }

  return (
    <div className="space-y-6">
      <RecipientForm onCreated={load} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="size-5 text-primary" />
            Получатели
            <span className="font-mono text-sm font-normal text-muted-foreground">
              {recipients.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Загрузка…
            </div>
          ) : recipients.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Пока нет получателей. Добавьте первого — без них отправки не уйдут.
            </p>
          ) : (
            <ol className="divide-y divide-border">
              {recipients.map((r, i) => (
                <li key={r.id} className="flex items-center gap-4 py-3">
                  <span className="w-6 shrink-0 text-center font-mono text-sm text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">
                      {r.familyName} {r.name} {r.middleName ?? ""}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      ИНН {r.inn} · {r.city}, {r.state} · {r.phoneNumber}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setEditing(r)}
                      title="Редактировать"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => remove(r.id, `${r.familyName} ${r.name}`)}
                      title="Удалить"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditRecipientDialog
          recipient={editing}
          onClose={(updated) => {
            setEditing(null);
            if (updated) load();
          }}
        />
      )}
    </div>
  );
}
