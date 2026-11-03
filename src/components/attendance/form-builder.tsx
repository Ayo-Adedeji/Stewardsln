"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  PlusIcon,
  TrashBinIcon,
} from "@/icons";
import type { FormFieldDefinition, FormFieldType, FormSchema } from "@/types/attendance";
import { useState } from "react";

interface FormBuilderProps {
  value: FormSchema;
  onChange: (schema: FormSchema) => void;
  allowDepartmentToggle?: boolean;
}

const FIELD_TYPE_OPTIONS: { id: FormFieldType; label: string }[] = [
  { id: "short_text", label: "Short Text" },
  { id: "email", label: "Email Address" },
  { id: "phone", label: "Phone Number" },
  { id: "number", label: "Number" },
  { id: "select", label: "Dropdown / Select" },
  { id: "radio", label: "Radio Buttons" },
  { id: "checkbox", label: "Checkboxes (Multi-select)" },
  { id: "yes_no", label: "Yes / No" },
];

export default function FormBuilder({
  value,
  onChange,
  allowDepartmentToggle = true,
}: FormBuilderProps) {
  const [newOptionTexts, setNewOptionTexts] = useState<Record<string, string>>({});

  const fields = value.fields || [];

  const updateFields = (newFields: FormFieldDefinition[]) => {
    onChange({ fields: newFields });
  };

  const handleAddField = (type: FormFieldType = "short_text") => {
    const randomId = `field_${Date.now().toString(36).slice(-5)}`;
    const newField: FormFieldDefinition = {
      id: randomId,
      type,
      label:
        type === "email"
          ? "Email Address"
          : type === "phone"
            ? "Phone Number"
            : type === "yes_no"
              ? "Is this your first time?"
              : "New Question",
      helpText: "",
      required: false,
      options: ["select", "radio", "checkbox"].includes(type)
        ? ["Option 1", "Option 2"]
        : undefined,
    };
    updateFields([...fields, newField]);
  };

  const handleUpdateField = (
    index: number,
    partial: Partial<FormFieldDefinition>,
  ) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...partial };
    updateFields(updated);
  };

  const handleRemoveField = (index: number) => {
    const updated = fields.filter((_, i) => i !== index);
    updateFields(updated);
  };

  const handleMoveField = (index: number, direction: "up" | "down") => {
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === fields.length - 1)
    ) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...fields];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    updateFields(updated);
  };

  const handleAddOption = (fieldIndex: number) => {
    const field = fields[fieldIndex];
    const text = (newOptionTexts[field.id] || "").trim();
    if (!text) return;
    const currentOptions = field.options || [];
    if (currentOptions.includes(text)) return;
    handleUpdateField(fieldIndex, { options: [...currentOptions, text] });
    setNewOptionTexts((prev) => ({ ...prev, [field.id]: "" }));
  };

  const handleRemoveOption = (fieldIndex: number, optIndex: number) => {
    const field = fields[fieldIndex];
    const currentOptions = field.options || [];
    handleUpdateField(fieldIndex, {
      options: currentOptions.filter((_, i) => i !== optIndex),
    });
  };

  // Department field toggle helper
  const hasDepartmentField = fields.some((f) => f.type === "department");

  const toggleDepartmentField = (enable: boolean) => {
    if (enable && !hasDepartmentField) {
      const deptField: FormFieldDefinition = {
        id: "department",
        type: "department",
        label: "Department",
        helpText: "Select your church workforce unit",
        required: true,
      };
      updateFields([...fields, deptField]);
    } else if (!enable && hasDepartmentField) {
      updateFields(fields.filter((f) => f.type !== "department"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--ln-border) pb-3">
        <div>
          <h3 className="text-sm font-semibold text-(--ln-fg-primary)">
            Registration Form Questions
          </h3>
          <p className="text-xs text-(--ln-fg-muted)">
            Customize the fields and questions attendees see during check-in.
          </p>
        </div>

        {allowDepartmentToggle && (
          <div className="flex items-center gap-2.5 rounded-xl border border-(--ln-border) bg-(--ln-surface-warm)/60 px-3 py-1.5">
            <span className="text-xs font-medium text-(--ln-fg-primary)">
              Collect Department:
            </span>
            <Switch
              checked={hasDepartmentField}
              onCheckedChange={toggleDepartmentField}
              size="sm"
            />
          </div>
        )}
      </div>

      <div className="space-y-3">
        {fields.map((field, index) => {
          const isSystemName = field.type === "full_name";
          const isSystemDept = field.type === "department";
          const hasOptions = ["select", "radio", "checkbox"].includes(field.type);

          return (
            <div
              key={field.id}
              className="rounded-2xl border border-(--ln-border) bg-(--ln-surface-warm)/30 p-4 transition-all hover:border-(--ln-border-strong)"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--ln-border)/60 pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-(--ln-surface) text-xs font-bold text-brand-600 dark:text-brand-400">
                    {index + 1}
                  </span>
                  <span className="text-xs font-semibold text-(--ln-fg-primary)">
                    {isSystemName
                      ? "Full Name (Primary Identifier)"
                      : isSystemDept
                        ? "Department Selection"
                        : FIELD_TYPE_OPTIONS.find((t) => t.id === field.type)?.label ||
                          field.type}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMoveField(index, "up")}
                    aria-label="Move up"
                    className="rounded p-1 text-(--ln-fg-muted) hover:text-(--ln-fg-primary) disabled:opacity-30"
                  >
                    <ArrowUpIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === fields.length - 1}
                    onClick={() => handleMoveField(index, "down")}
                    aria-label="Move down"
                    className="rounded p-1 text-(--ln-fg-muted) hover:text-(--ln-fg-primary) disabled:opacity-30"
                  >
                    <ArrowDownIcon className="size-3.5" />
                  </button>
                  {!isSystemName && (
                    <button
                      type="button"
                      onClick={() => handleRemoveField(index)}
                      aria-label="Remove field"
                      className="rounded p-1 text-(--ln-fg-muted) hover:text-red-600"
                    >
                      <TrashBinIcon className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  <Field>
                    <FieldLabel className="text-xs">Field Label</FieldLabel>
                    <Input
                      type="text"
                      value={field.label}
                      disabled={isSystemName}
                      onChange={(e) =>
                        handleUpdateField(index, { label: e.target.value })
                      }
                      className="h-8.5 text-xs"
                    />
                  </Field>
                </div>

                <div className="sm:col-span-4">
                  <Field>
                    <FieldLabel className="text-xs">Field Type</FieldLabel>
                    {isSystemName || isSystemDept ? (
                      <Input
                        value={
                          isSystemName
                            ? "Full Name (Required)"
                            : "Church Department"
                        }
                        disabled
                        className="h-8.5 text-xs"
                      />
                    ) : (
                      <Select
                        value={field.type}
                        onValueChange={(val) => {
                          const newType = val as FormFieldType;
                          handleUpdateField(index, {
                            type: newType,
                            options: ["select", "radio", "checkbox"].includes(
                              newType,
                            )
                              ? field.options || ["Option 1", "Option 2"]
                              : undefined,
                          });
                        }}
                      >
                        <SelectTrigger className="h-8.5 text-xs">
                          <SelectValue placeholder="Type" />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.id} value={opt.id}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                </div>

                <div className="flex items-center gap-2 pt-5 sm:col-span-2">
                  <Checkbox
                    id={`req-${field.id}`}
                    checked={field.required ?? false}
                    disabled={isSystemName}
                    onCheckedChange={(checked) =>
                      handleUpdateField(index, { required: Boolean(checked) })
                    }
                  />
                  <label
                    htmlFor={`req-${field.id}`}
                    className="cursor-pointer text-xs font-medium text-(--ln-fg-primary)"
                  >
                    Required
                  </label>
                </div>

                <div className="sm:col-span-12">
                  <Field>
                    <FieldLabel className="text-xs">
                      Helper Text / Placeholder (Optional)
                    </FieldLabel>
                    <Input
                      type="text"
                      value={field.helpText || ""}
                      onChange={(e) =>
                        handleUpdateField(index, { helpText: e.target.value })
                      }
                      placeholder="e.g. Enter your mobile line for ministry alerts..."
                      className="h-8.5 text-xs"
                    />
                  </Field>
                </div>
              </div>

              {/* Options configuration for select / radio / checkbox */}
              {hasOptions && (
                <div className="mt-3 rounded-xl border border-(--ln-border) bg-(--ln-surface) p-3">
                  <span className="mb-2 block text-xs font-semibold text-(--ln-fg-primary)">
                    Available Options:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(field.options || []).map((opt, optIndex) => (
                      <span
                        key={optIndex}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-(--ln-border) bg-(--ln-surface-warm) px-2.5 py-1 text-xs text-(--ln-fg-primary)"
                      >
                        <span>{opt}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(index, optIndex)}
                          aria-label={`Remove ${opt}`}
                          className="text-(--ln-fg-muted) hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <Input
                      type="text"
                      placeholder="Add an option (e.g. Yes, No, Youth)..."
                      value={newOptionTexts[field.id] || ""}
                      onChange={(e) =>
                        setNewOptionTexts((prev) => ({
                          ...prev,
                          [field.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOption(index);
                        }
                      }}
                      className="h-8 text-xs"
                    />
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={() => handleAddOption(index)}
                    >
                      Add Option
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => handleAddField("short_text")}
        >
          <PlusIcon className="size-3.5" />
          Add Question
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => handleAddField("phone")}
        >
          + Phone Number
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => handleAddField("email")}
        >
          + Email
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => handleAddField("yes_no")}
        >
          + Yes/No
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => handleAddField("select")}
        >
          + Dropdown
        </Button>
      </div>
    </div>
  );
}
