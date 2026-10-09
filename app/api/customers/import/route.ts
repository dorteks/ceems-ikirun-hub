import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseAndImportXlsx } from "../../../../server/services/importService";
import {
  createImportJob,
  getImportJobById,
  type ImportJobStatus,
  updateImportJob,
} from "../../../../server/services/importJobService";
import { getSessionUser } from "../../../../server/services/userService";
import { recordAuditEvent } from "../../../../server/services/auditService";

export const runtime = "nodejs";

const SESSION_COOKIE = "ceems_session";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = Number(cookieStore.get(SESSION_COOKIE)?.value);

  if (!Number.isInteger(userId)) {
    return null;
  }

  return getSessionUser(userId);
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const commit = String(form.get("commit") || "false") === "true";
    const jobIdValue = form.get("jobId");
    const jobId =
      jobIdValue === null || jobIdValue === undefined || jobIdValue === ""
        ? null
        : Number(jobIdValue);

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Check the existing job before parsing a commit request can write customers.
    if (commit && jobId !== null) {
      const existingJob = Number.isInteger(jobId)
        ? await getImportJobById(jobId)
        : null;

      if (!existingJob) {
        return NextResponse.json({ error: "Import job not found" }, { status: 404 });
      }

      if (
        existingJob.uploadedBy?.id !== currentUser.id &&
        currentUser.role !== "Super Administrator"
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (existingJob.status === "FAILED") {
        return NextResponse.json(
          {
            error:
              "This import has validation errors. Download the error report to correct and re-upload.",
          },
          { status: 409 },
        );
      }
    }

    const buffer = await file.arrayBuffer();
    const result = await parseAndImportXlsx(buffer, { commit });
    const now = new Date();
    const hasValidationErrors = (result.invalid_count ?? 0) > 0;
    if (commit && hasValidationErrors) {
      return NextResponse.json(
        {
          ...result,
          error:
            "This import has validation errors. Correct the reported rows and re-upload.",
        },
        { status: 409 },
      );
    }

    const status: ImportJobStatus = commit
      ? "COMMITTED"
      : hasValidationErrors
        ? "FAILED"
        : "VALIDATED";
    const jobPayload = {
      fileName: file.name,
      status,
      totalRows: result.total_rows ?? 0,
      validRows: result.valid_count ?? 0,
      invalidRows: result.invalid_count ?? 0,
      duplicateRows: result.duplicates_count ?? 0,
      importedRows: result.imported ?? 0,
      previewRows: result.preview ?? [],
      validationErrors: result.errors ?? [],
      duplicateRecords: result.duplicates ?? [],
      uploadedById: currentUser.id,
      completedAt: now,
    };

    let job;

    if (commit && jobId !== null) {
      job = await updateImportJob(jobId, {
        status: "COMMITTED",
        totalRows: jobPayload.totalRows,
        validRows: jobPayload.validRows,
        invalidRows: jobPayload.invalidRows,
        duplicateRows: jobPayload.duplicateRows,
        importedRows: jobPayload.importedRows,
        previewRows: jobPayload.previewRows,
        validationErrors: jobPayload.validationErrors,
        duplicateRecords: jobPayload.duplicateRecords,
        completedAt: now,
      });
    } else {
      job = await createImportJob(jobPayload);
    }

    await recordAuditEvent({
      actorName: currentUser.name,
      actorUsername: currentUser.username,
      actorRole: currentUser.role,
      action: job.status === "COMMITTED" ? "Committed import" : "Validated import",
      entityType: "import",
      entityId: job.id,
      entityLabel: job.fileName,
      beforeValue: commit ? "Validated preview" : "Upload",
      afterValue:
        job.status === "COMMITTED"
          ? `${job.importedRows.toLocaleString()} rows imported`
          : `${job.validRows.toLocaleString()} valid · ${job.invalidRows.toLocaleString()} invalid`,
      metadata: {
        total_rows: job.totalRows,
        valid_rows: job.validRows,
        invalid_rows: job.invalidRows,
        duplicate_rows: job.duplicateRows,
      },
      occurredAt: now,
    });

    return NextResponse.json(
      {
        message:
          job.status === "FAILED"
            ? "Validation failed"
            : commit
              ? "Import completed"
              : "Preview generated",
        jobId: job.id,
        job,
        ...result,
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    console.error("Import failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message || "Import failed" },
      { status: 500 },
    );
  }
}
