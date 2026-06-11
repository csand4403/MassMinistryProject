import { updateOwnAssignmentResponse } from "@/lib/actions";
import type { AssignmentStatus } from "@/types";

interface AssignmentResponseButtonsProps {
  assignmentId: string;
  status: AssignmentStatus;
}

export function AssignmentResponseButtons({ assignmentId, status }: AssignmentResponseButtonsProps) {
  if (status === "CHECKED_IN" || status === "ABSENT") return null;
  const confirmAssignment = async () => {
    "use server";
    await updateOwnAssignmentResponse(assignmentId, "CONFIRMED");
  };
  const declineAssignment = async () => {
    "use server";
    await updateOwnAssignmentResponse(assignmentId, "DECLINED");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "CONFIRMED" && (
        <form action={confirmAssignment}>
          <button
            type="submit"
            className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-600"
          >
            Confirm
          </button>
        </form>
      )}
      {status !== "DECLINED" && (
        <form action={declineAssignment}>
          <button
            type="submit"
            className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-50"
          >
            Decline
          </button>
        </form>
      )}
    </div>
  );
}
