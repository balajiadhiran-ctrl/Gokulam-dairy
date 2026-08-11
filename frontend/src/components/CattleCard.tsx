import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useDataNames } from "../i18n/dataNames";
import type { Cattle } from "../lib/types";

const TYPE_EMOJI: Record<string, string> = { cow: "🐄", buffalo: "🐃" };
const STATUS_STYLE: Record<string, string> = {
  active: "bg-brand-100 text-brand-700",
  dry: "bg-slate-100 text-slate-600",
  sold: "bg-amber-100 text-amber-700",
  deceased: "bg-red-100 text-red-700",
};
const STATUS_KEY: Record<string, string> = {
  active: "cattle.statusActive",
  dry: "cattle.statusDry",
  sold: "cattle.statusSold",
  deceased: "cattle.statusDeceased",
};

export function CattleCard({ cattle, onEdit }: { cattle: Cattle; onEdit: (c: Cattle) => void }) {
  const { t } = useTranslation();
  const { breed: breedName } = useDataNames();
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cattle"] });
    queryClient.invalidateQueries({ queryKey: ["owners"] });
  };

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/cattle/${cattle.id}/photo`, fd);
    },
    onSuccess: invalidate,
    onError: () => setUploadError(t("cattle.uploadError")),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await api.delete(`/cattle/${cattle.id}`);
    },
    onSuccess: invalidate,
  });

  return (
    <div className="overflow-hidden rounded-2xl glass">
      {/* Photo / placeholder */}
      <div className="relative flex aspect-square items-center justify-center bg-brand-50">
        {cattle.photo_url ? (
          <img src={cattle.photo_url} alt={cattle.tag_number} className="h-full w-full object-cover" />
        ) : (
          <span className="text-6xl opacity-70">{TYPE_EMOJI[cattle.animal_type] ?? "🐄"}</span>
        )}
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${
            STATUS_STYLE[cattle.status] ?? "bg-slate-100 text-slate-600"
          }`}
        >
          {t(STATUS_KEY[cattle.status] ?? "cattle.statusActive")}
        </span>
        {can("cattle.update") && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-700 shadow hover:bg-white disabled:opacity-60"
          >
            {upload.isPending ? t("cattle.uploading") : cattle.photo_url ? t("cattle.changePhoto") : t("cattle.addPhoto")}
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            setUploadError(null);
            const f = e.target.files?.[0];
            if (f) upload.mutate(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* Details */}
      <div className="p-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800">{cattle.tag_number}</span>
          <span className="text-xs text-slate-400">
            {cattle.animal_type === "cow" ? t("cattle.cow") : t("cattle.buffalo")}
          </span>
        </div>
        <div className="mt-0.5 text-sm text-slate-500">
          {cattle.breed ? breedName(cattle.breed) : t("cattle.breedDash")}
          {cattle.name ? ` · ${cattle.name}` : ""}
        </div>
        {uploadError && <div className="mt-1 text-[11px] text-red-500">{uploadError}</div>}

        {(can("cattle.update") || can("cattle.delete")) && (
          <div className="mt-3 flex gap-2">
            {can("cattle.update") && (
              <button
                onClick={() => onEdit(cattle)}
                className="flex-1 rounded-lg border border-slate-200 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                {t("common.edit")}
              </button>
            )}
            {can("cattle.delete") && (
              <button
                onClick={() => {
                  if (confirm(t("cattle.removeConfirm", { tag: cattle.tag_number }))) remove.mutate();
                }}
                disabled={remove.isPending}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                {t("common.delete")}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
