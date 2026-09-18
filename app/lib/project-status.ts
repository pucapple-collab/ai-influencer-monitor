// One reserved setup_tasks row: latest snapshot only, never a log history.
export const PROJECT_STATUS_ID = "4ae82559-1174-4fb7-8da2-df29d4dce411";
export const PROJECT_STATUS_COLUMNS =
  "task_id,title,status,required_input,blocked_reason,updated_at";

export type ProjectStatus = {
  task_id: string;
  title: string;
  status: string;
  required_input: string | null;
  blocked_reason: string | null;
  updated_at: string;
};
