import { ArrowLeft, Eye, Loader2, Pencil, Save } from "lucide-react";
import { MdPreview } from "md-editor-rt";
import "md-editor-rt/lib/style.css";
import { useEffect, useState } from "react";
import { Form, Link, useSubmit } from "react-router";
import { useResolvedTheme } from "../hooks/useResolvedTheme";
import { cn } from "../lib/utils";
import { NoteMetadataEditor } from "./NoteMetadataEditor";
import { ThemeToggle } from "./theme-toggle";
import { AppBar } from "./ui/AppBar";
import { Button } from "./ui/Button";
import { useUI } from "./ui/UIProvider";

interface NoteEditorLayoutProps {
    title: string;
    backLink: string;
    formId: string;
    isSubmitting: boolean;
    initialTitle?: string;
    initialSlug?: string;
    initialContent?: string;
    initialIsPublic?: boolean;
    errors?: {
        title?: string;
        slug?: string;
        content?: string;
        global?: string;
    };
}

export function NoteEditorLayout({
    title,
    backLink,
    formId,
    isSubmitting,
    initialTitle = "",
    initialSlug = "",
    initialContent = "",
    initialIsPublic = false,
    errors,
}: NoteEditorLayoutProps) {
    const [content, setContent] = useState(initialContent);
    const [isPublic, setIsPublic] = useState(initialIsPublic);
    const [isPreviewMode, setIsPreviewMode] = useState(false);
    const resolvedTheme = useResolvedTheme();
    const submit = useSubmit();
    const { showSnackbar } = useUI();

    const handleSave = () => {
        const form = document.getElementById(formId) as HTMLFormElement | null;
        if (form) {
            submit(form);
        }
    };

    const handleEditorKeyDown = (
        event: React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            handleSave();
        }

        if (event.key === "Tab") {
            event.preventDefault();
            const textarea = event.currentTarget;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const nextContent =
                content.slice(0, start) + "    " + content.slice(end);

            setContent(nextContent);

            requestAnimationFrame(() => {
                textarea.selectionStart = start + 4;
                textarea.selectionEnd = start + 4;
            });
        }
    };

    useEffect(() => {
        if (errors?.global) {
            showSnackbar(errors.global);
        }
    }, [errors?.global, showSnackbar]);

    return (
        <div className="flex flex-col h-screen bg-background">
            <AppBar
                className="bg-background/80 backdrop-blur-md px-4"
                title={title}
                startAction={
                    <Link to={backLink} viewTransition tabIndex={-1}>
                        <Button
                            variant="icon"
                            icon={<ArrowLeft className="w-6 h-6" />}
                        />
                    </Link>
                }
                endAction={
                    <div className="flex items-center gap-2 pe-2">
                        <Button
                            type="button"
                            variant="icon"
                            className="hidden md:inline-flex"
                            title={isPreviewMode ? "Edit" : "Preview"}
                            aria-label={isPreviewMode ? "Edit note" : "Preview note"}
                            onClick={() => setIsPreviewMode((value) => !value)}
                            icon={
                                isPreviewMode ? (
                                    <Pencil className="w-5 h-5" />
                                ) : (
                                    <Eye className="w-5 h-5" />
                                )
                            }
                        />
                        <Link
                            to={backLink}
                            className="hidden md:block"
                            viewTransition
                            tabIndex={-1}
                        >
                            <Button variant="text">Cancel</Button>
                        </Link>
                        <Button
                            form={formId}
                            type="submit"
                            disabled={isSubmitting}
                            variant="filled"
                            icon={
                                isSubmitting ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )
                            }
                        >
                            Save
                        </Button>
                        <ThemeToggle />
                    </div>
                }
            />

            <main className="flex-1 w-full pb-4 md:pb-6 max-w-7xl mx-auto overflow-hidden flex flex-col">
                <Form
                    method="post"
                    id={formId}
                    className="flex flex-col gap-6 h-full"
                >
                    <NoteMetadataEditor
                        title={initialTitle}
                        isPublic={isPublic}
                        slug={initialSlug}
                        errors={errors}
                        onIsPublicChange={setIsPublic}
                    />

                    <div className="flex-1 min-h-0 overflow-hidden px-4 py-1.5 mb-2 flex flex-col">
                        <div
                            className={cn(
                                "flex-1 min-h-0 transition-all rounded-2xl overflow-hidden ring-1 bg-background flex flex-col",
                                errors?.content ? "ring-error" : "ring-outline"
                            )}
                        >
                            <div
                                className={cn(
                                    "h-1/2 min-h-0 overflow-hidden md:h-full",
                                    isPreviewMode && "md:hidden"
                                )}
                            >
                                <textarea
                                    name="content"
                                    value={content}
                                    onChange={(event) =>
                                        setContent(event.target.value)
                                    }
                                    onKeyDown={handleEditorKeyDown}
                                    wrap="soft"
                                    spellCheck={false}
                                    autoCapitalize="off"
                                    autoCorrect="off"
                                    className={cn(
                                        "block h-full w-full resize-none overflow-auto",
                                        "bg-background text-on-background",
                                        "px-4 py-4 md:px-5 md:py-5",
                                        "font-mono text-base leading-7",
                                        "border-0 outline-none focus:outline-none",
                                        "whitespace-pre-wrap break-words [overflow-wrap:anywhere]",
                                        "[word-break:break-word] [text-overflow:clip]"
                                    )}
                                    aria-label="Note content"
                                />
                            </div>

                            <div
                                className={cn(
                                    "h-1/2 min-h-0 overflow-auto border-t border-outline-variant md:h-full md:border-t-0",
                                    !isPreviewMode && "md:hidden"
                                )}
                            >
                                <MdPreview
                                    modelValue={content}
                                    theme={resolvedTheme}
                                    language="en-US"
                                    codeTheme="github"
                                    previewTheme="github"
                                    className="min-h-full bg-background! prose"
                                />
                            </div>
                        </div>

                        {errors?.content && (
                            <p className="mt-2 text-xs text-error ml-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                {errors.content}
                            </p>
                        )}
                    </div>
                </Form>
            </main>
        </div>
    );
}
