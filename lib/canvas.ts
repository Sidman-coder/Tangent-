// lib/canvas.ts
//
// GET-ONLY BY DESIGN. This module only ever issues GET requests to the Canvas
// LMS REST API using a personal access token. It must never be extended with
// POST, PUT, PATCH, or DELETE calls — read-only access to courses,
// assignments, and files only.

export type Course = {
  id: string;
  name: string;
  courseCode: string;
};

export type Assignment = {
  id: string;
  name: string;
  courseId: string;
  courseName: string;
  dueAt: string | null;
  pointsPossible: number | null;
  description: string;
  htmlUrl: string;
};

export type CanvasFile = {
  id: string;
  name: string;
  contentType: string;
  url: string;
  size: number;
};

function canvasBase(): { baseUrl: string; token: string } {
  const baseUrl = process.env.CANVAS_BASE_URL;
  const token = process.env.CANVAS_API_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("Missing CANVAS_BASE_URL or CANVAS_API_TOKEN in .env.local");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), token };
}

async function canvasGet<T>(path: string): Promise<T> {
  const { baseUrl, token } = canvasBase();
  const res = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Canvas GET ${path} failed: ${res.status} ${err}`);
  }
  return (await res.json()) as T;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+/g, " ")
    .trim();
}

type CanvasCourseResource = { id: number; name: string; course_code: string };

/** Fetches all active courses for the user. GET-only. */
export async function getCanvasCourses(): Promise<Course[]> {
  const courses = await canvasGet<CanvasCourseResource[]>(
    "/api/v1/courses?enrollment_state=active&per_page=100"
  );
  return courses
    .filter((c) => c && c.name)
    .map((c) => ({ id: String(c.id), name: c.name, courseCode: c.course_code ?? "" }));
}

type CanvasAssignmentResource = {
  id: number;
  name: string;
  due_at: string | null;
  points_possible: number | null;
  description: string | null;
  html_url: string;
};

/** Fetches assignments for one specific course. GET-only. */
export async function getCourseAssignments(courseId: string): Promise<Assignment[]> {
  const courses = await getCanvasCourses();
  const courseName = courses.find((c) => c.id === courseId)?.name ?? "";

  const assignments = await canvasGet<CanvasAssignmentResource[]>(
    `/api/v1/courses/${courseId}/assignments?per_page=100&order_by=due_at`
  );

  return assignments.map((a) => ({
    id: String(a.id),
    name: a.name,
    courseId,
    courseName,
    dueAt: a.due_at,
    pointsPossible: a.points_possible,
    description: a.description ? stripHtml(a.description).slice(0, 1000) : "",
    htmlUrl: a.html_url,
  }));
}

/** Fetches upcoming assignments across all courses, sorted by due date. GET-only. */
export async function getUpcomingAssignments(daysAhead: number): Promise<Assignment[]> {
  const courses = await getCanvasCourses();
  const now = Date.now();
  const horizon = now + Math.max(1, daysAhead || 14) * 86400000;

  const all: Assignment[] = [];
  for (const course of courses) {
    try {
      const assignments = await getCourseAssignments(course.id);
      all.push(...assignments);
    } catch {
      // Skip courses whose assignments can't be fetched rather than failing the whole request.
      continue;
    }
  }

  return all
    .filter((a) => {
      if (!a.dueAt) return false;
      const due = new Date(a.dueAt).getTime();
      return due >= now - 86400000 && due <= horizon;
    })
    .sort((a, b) => new Date(a.dueAt!).getTime() - new Date(b.dueAt!).getTime());
}

type CanvasFileResource = {
  id: number;
  display_name: string;
  "content-type": string;
  url: string;
  size: number;
};

/** Lists files available in a course (name, type, download URL, size). GET-only. */
export async function getCourseFiles(courseId: string): Promise<CanvasFile[]> {
  const files = await canvasGet<CanvasFileResource[]>(
    `/api/v1/courses/${courseId}/files?per_page=100`
  );
  return files.map((f) => ({
    id: String(f.id),
    name: f.display_name,
    contentType: f["content-type"],
    url: f.url,
    size: f.size,
  }));
}

/**
 * Downloads a file and extracts text content if it is a PDF, DOCX, or plain text file.
 * Returns null for unsupported file types (images, videos) rather than attempting to read them.
 * GET-only — downloads via the file's existing signed Canvas URL.
 */
export async function getFileTextContent(fileUrl: string, fileName: string): Promise<string | null> {
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const supported = ["pdf", "docx", "txt", "md"];
  if (!supported.includes(ext)) return null;

  const { token } = canvasBase();
  const res = await fetch(fileUrl, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Canvas file download failed: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (ext === "txt" || ext === "md") {
    return buffer.toString("utf-8");
  }

  if (ext === "pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  return null;
}
