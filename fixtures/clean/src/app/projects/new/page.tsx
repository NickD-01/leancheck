import { SubmitButton } from "@/components/submit-button";
import { createProject } from "../actions";

export default function NewProjectPage() {
  return (
    <form action={createProject}>
      <label>
        Name
        <input name="name" required maxLength={120} />
      </label>
      <label>
        Description
        <textarea name="description" maxLength={2000} />
      </label>
      <label>
        Budget (EUR)
        <input name="budget" inputMode="decimal" defaultValue="0" />
      </label>
      <SubmitButton>Create</SubmitButton>
    </form>
  );
}
