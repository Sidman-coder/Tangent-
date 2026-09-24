interface ResourceClickResource {
  label: string
  url: string
}

interface ResourceClickTask {
  id?: string
  title?: string
  planId?: string | null
}

export function handleResourceClick(resource: ResourceClickResource, task: ResourceClickTask): void {
  window.open(resource.url, "_blank", "noopener,noreferrer")
}
