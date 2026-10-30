"use client";

import { useOptimistic, useTransition } from "react";
import { setTaskDone } from "@/app/projects/actions";

type TaskToggleProps = { taskId: string; title: string; done: boolean };

export function TaskToggle({ taskId, title, done }: TaskToggleProps) {
  const [optimisticDone, setOptimisticDone] = useOptimistic(done);
  const [pending, startTransition] = useTransition();

  return (
    <label>
      <input
        type="checkbox"
        checked={optimisticDone}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked;
          startTransition(async () => {
            setOptimisticDone(next);
            await setTaskDone(taskId, next);
          });
        }}
      />
      {title}
    </label>
  );
}
