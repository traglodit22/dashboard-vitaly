"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Recipient } from "@/types";

export type RecipientDraft = Omit<Recipient, "id" | "createdAt">;

export const EMPTY_RECIPIENT: RecipientDraft = {
  familyName: "",
  name: "",
  middleName: "",
  passportSerial: "",
  passportNumber: "",
  passportIssueDate: "",
  birthDate: "",
  inn: "",
  fullAddress: "",
  city: "",
  state: "",
  zipCode: "",
  phoneNumber: "",
  email: "",
};

// Поля получателя — общие для создания и редактирования.
export function RecipientFields({
  form,
  set,
}: {
  form: RecipientDraft;
  set: (key: keyof RecipientDraft) => (value: string) => void;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <F label="Фамилия" v={form.familyName} on={set("familyName")} />
        <F label="Имя" v={form.name} on={set("name")} />
        <F
          label="Отчество"
          optional
          v={form.middleName ?? ""}
          on={set("middleName")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <F
          label="Серия паспорта"
          optional
          v={form.passportSerial}
          on={set("passportSerial")}
          mono
          maxLength={4}
          placeholder="0000 (РФ)"
        />
        <F
          label="Номер паспорта"
          v={form.passportNumber}
          on={set("passportNumber")}
          mono
          maxLength={9}
          placeholder="6 цифр РФ / 9 РБ"
        />
        <F
          label="Дата выдачи"
          type="date"
          v={form.passportIssueDate}
          on={set("passportIssueDate")}
        />
        <F
          label="Дата рождения"
          type="date"
          optional
          v={form.birthDate ?? ""}
          on={set("birthDate")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <F
          label="ИНН"
          optional
          v={form.inn}
          on={set("inn")}
          mono
          maxLength={12}
          placeholder="12 цифр (РФ), для РБ — пусто"
        />
        <F
          label="Email"
          type="email"
          v={form.email}
          on={set("email")}
          placeholder="name@mail.ru"
        />
      </div>

      <F
        label="Полный адрес"
        v={form.fullAddress}
        on={set("fullAddress")}
        placeholder="ул., дом, кв."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <F label="Город" v={form.city} on={set("city")} />
        <F label="Область" v={form.state} on={set("state")} />
        <F label="Индекс" v={form.zipCode} on={set("zipCode")} mono />
        <F
          label="Телефон"
          type="tel"
          v={form.phoneNumber}
          on={set("phoneNumber")}
          mono
          placeholder="+7..."
        />
      </div>
    </>
  );
}

function F({
  label,
  v,
  on,
  type = "text",
  optional,
  mono,
  maxLength,
  placeholder,
}: {
  label: string;
  v: string;
  on: (value: string) => void;
  type?: string;
  optional?: boolean;
  mono?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {optional && <span className="text-muted-foreground/50"> — необяз.</span>}
      </Label>
      <Input
        type={type}
        value={v}
        maxLength={maxLength}
        placeholder={placeholder}
        className={mono ? "font-mono" : undefined}
        onChange={(e) => on(e.target.value)}
      />
    </div>
  );
}
