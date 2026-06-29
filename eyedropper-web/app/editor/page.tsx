import EditorShell from "@/components/Editor"

export default async function EditorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <p className="text-[var(--color-text-secondary)] text-center px-8">
          No image ID provided.{" "}
          <a href="/" className="underline text-[var(--color-accent)]">
            Go back
          </a>
        </p>
      </div>
    )
  }
  const claudeAvailable = !!process.env.ANTHROPIC_API_KEY
  return <EditorShell imageId={id} claudeAvailable={claudeAvailable} />
}
