import { ArrowLeft, Loader2, Save } from "lucide-react";
import { MdEditor } from "md-editor-rt";
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

    // 服务端渲染时默认按桌面端处理；客户端挂载后立即根据屏幕宽度更新。
    const [isMobile, setIsMobile] = useState(false);

    const resolvedTheme = useResolvedTheme();
    const submit = useSubmit();
    const { showSnackbar } = useUI();

    const handleSave = () => {
        const form = document.getElementById(formId) as HTMLFormElement | null;
        if (form) {
            submit(form);
        }
    };

    useEffect(() => {
        const mediaQuery = window.matchMedia("(max-width: 640px)");

        const updateMobileState = () => {
            setIsMobile(mediaQuery.matches);
        };

        updateMobileState();
        mediaQuery.addEventListener("change", updateMobileState);

        return () => {
            mediaQuery.removeEventListener("change", updateMobileState);
        };
    }, []);

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

                    <input type="hidden" name="content" value={content} />

                    <div className="flex-1 min-h-0 overflow-hidden px-4 py-1.5 mb-2 flex flex-col">
                        <div
                            className={cn(
                                "flex-1 min-h-0 transition-all rounded-2xl overflow-hidden ring-1 bg-background",
                                errors?.content ? "ring-error" : "ring-outline"
                            )}
                        >
                            <MdEditor
                                modelValue={content}
                                onChange={setContent}
                                onSave={handleSave}
                                theme={resolvedTheme}
                                language="en-US"
                                codeTheme="github"
                                previewTheme="github"
                                // 移动端关闭预览后，MdEditor 会使用原生单栏源码布局。
                                // 不再设置 inputBoxWidth，避免和组件内部布局发生冲突。
                                preview={!isMobile}
                                // 移动端隐藏工具栏中的预览按钮，避免误切回双栏。
                                toolbarsExclude={isMobile ? ["preview"] : []}
                                className="edge-note-editor h-full bg-background!"
                                style={{ height: "100%" }}
                            />
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
