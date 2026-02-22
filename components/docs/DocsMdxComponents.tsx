"use client";

import React from "react";
import {
  ButtonOrDropdownButton,
  GenericJsxEditor,
  insertJsx$,
  type JsxComponentDescriptor,
  type JsxEditorProps,
  NestedLexicalEditor,
  useMdastNodeUpdater,
  usePublisher,
} from "@mdxeditor/editor";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
  X as CloseIcon,
} from "lucide-react";

const TAB_COMPONENT_SOURCE = "@/components/docs/LayoutComponents/Tabs";
const VIDEO_CARD_SOURCE = "@/components/docs/VideoCard/VideoCard";
const ACADEMY_CARD_SOURCE = "@/components/docs/AcademyCard/AcademyCard";

type MdxJsxAttribute = {
  type: "mdxJsxAttribute";
  name: string;
  value?: string | { type: string; value: string } | null;
};

type MdxJsxFlowElement = {
  type: "mdxJsxFlowElement";
  name: string | null;
  attributes?: MdxJsxAttribute[];
  children?: any[];
};

const readJsxAttributeValue = (value: MdxJsxAttribute["value"]) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value) {
    return value.value;
  }
  return "";
};

const getJsxProps = (
  node: MdxJsxFlowElement,
  propNames: string[]
): Record<string, string> => {
  return propNames.reduce<Record<string, string>>((acc, propName) => {
    const attribute = node.attributes?.find(
      (attr) =>
        attr.type === "mdxJsxAttribute" && attr.name === propName
    );
    acc[propName] = readJsxAttributeValue(attribute?.value);
    return acc;
  }, {});
};

const isTabItem = (node: any): node is MdxJsxFlowElement =>
  node?.type === "mdxJsxFlowElement" && node?.name === "TabItem";

const getTabItems = (children: any[] | undefined) =>
  (children ?? []).filter(isTabItem) as MdxJsxFlowElement[];

const getOtherChildren = (children: any[] | undefined) =>
  (children ?? []).filter((child) => !isTabItem(child));

const getTabName = (tab: MdxJsxFlowElement) => {
  const attr = tab.attributes?.find(
    (attribute) =>
      attribute.type === "mdxJsxAttribute" && attribute.name === "name"
  );
  if (typeof attr?.value === "string") {
    return attr.value;
  }
  return "";
};

const setTabName = (tab: MdxJsxFlowElement, name: string) => {
  const attributes = [...(tab.attributes ?? [])];
  const existingIndex = attributes.findIndex(
    (attribute) =>
      attribute.type === "mdxJsxAttribute" && attribute.name === "name"
  );

  if (existingIndex >= 0) {
    attributes[existingIndex] = {
      ...attributes[existingIndex],
      value: name,
    };
  } else {
    attributes.push({
      type: "mdxJsxAttribute",
      name: "name",
      value: name,
    });
  }

  return {
    ...tab,
    attributes,
  } as MdxJsxFlowElement;
};

const createTabItem = (name: string): MdxJsxFlowElement => ({
  type: "mdxJsxFlowElement",
  name: "TabItem",
  attributes: [
    {
      type: "mdxJsxAttribute",
      name: "name",
      value: name,
    },
  ],
  children: [{ type: "paragraph", children: [] }],
});

function TabsWrapperEditor({ mdastNode }: JsxEditorProps) {
  const updateMdastNode = useMdastNodeUpdater();
  const tabs = React.useMemo(
    () => getTabItems(mdastNode.children),
    [mdastNode]
  );
  const otherChildren = React.useMemo(
    () => getOtherChildren(mdastNode.children),
    [mdastNode]
  );
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    if (tabs.length === 0) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex > tabs.length - 1) {
      setActiveIndex(tabs.length - 1);
    }
  }, [tabs.length, activeIndex]);

  const updateTabs = React.useCallback(
    (nextTabs: MdxJsxFlowElement[]) => {
      updateMdastNode({ children: [...nextTabs, ...otherChildren] });
    },
    [updateMdastNode, otherChildren]
  );

  const handleTabNameChange = (index: number, name: string) => {
    const nextTabs = tabs.map((tab, tabIndex) =>
      tabIndex === index ? setTabName(tab, name) : tab
    );
    updateTabs(nextTabs);
  };

  const handleAddTab = () => {
    const nextTabs = [...tabs, createTabItem(`Tab ${tabs.length + 1}`)];
    updateTabs(nextTabs);
    setActiveIndex(nextTabs.length - 1);
  };

  const handleRemoveTab = (index: number) => {
    const nextTabs = tabs.filter((_, tabIndex) => tabIndex !== index);
    updateTabs(nextTabs);
    if (activeIndex >= nextTabs.length) {
      setActiveIndex(Math.max(0, nextTabs.length - 1));
    }
  };

  const moveTab = (from: number, to: number) => {
    if (to < 0 || to >= tabs.length) return;
    const nextTabs = [...tabs];
    const [moved] = nextTabs.splice(from, 1);
    nextTabs.splice(to, 0, moved);
    updateTabs(nextTabs);
    setActiveIndex(to);
  };

  const activeTab = tabs[activeIndex];
  const activeTabName =
    (activeTab && getTabName(activeTab)) || `Tab ${activeIndex + 1}`;

  return (
    <div className="tabs-wrapper border border-border bg-muted/20">
      <div className="tabs-nav">
        {tabs.map((tab, index) => {
          const tabName = getTabName(tab) || `Tab ${index + 1}`;
          const isActive = index === activeIndex;
          return (
            <button
              key={`${tabName}-${index}`}
              type="button"
              className={`tab-btn ${isActive ? "active" : ""}`}
              onClick={() => setActiveIndex(index)}
            >
              {tabName}
            </button>
          );
        })}
        {tabs.length === 0 && (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            No tabs yet.
          </div>
        )}
      </div>

      <div className="tab-content space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-semibold text-muted-foreground">
            Tab name
          </span>
          <input
            type="text"
            className="min-w-[160px] flex-1 rounded-sm border border-border bg-background px-2 py-1 text-xs"
            value={activeTabName}
            onChange={(event) =>
              handleTabNameChange(activeIndex, event.target.value)
            }
            onFocus={() => setActiveIndex(activeIndex)}
            placeholder={`Tab ${activeIndex + 1}`}
            disabled={!activeTab}
          />
          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="inline-flex items-center rounded-sm border border-border bg-background p-1 hover:bg-muted disabled:opacity-50"
              onClick={() => moveTab(activeIndex, activeIndex - 1)}
              aria-label="Move tab left"
              disabled={!activeTab}
            >
              <ArrowLeft className="size-3" />
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-sm border border-border bg-background p-1 hover:bg-muted disabled:opacity-50"
              onClick={() => moveTab(activeIndex, activeIndex + 1)}
              aria-label="Move tab right"
              disabled={!activeTab}
            >
              <ArrowRight className="size-3" />
            </button>
            <button
              type="button"
              className="inline-flex items-center rounded-sm border border-border bg-background p-1 text-destructive hover:bg-destructive/10 disabled:opacity-50"
              onClick={() => handleRemoveTab(activeIndex)}
              aria-label="Remove tab"
              disabled={!activeTab}
            >
              <Trash2 className="size-3" />
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
              onClick={handleAddTab}
            >
              <Plus className="size-3" />
              Add tab
            </button>
          </div>
        </div>

        {activeTab ? (
          <NestedLexicalEditor
            key={`tab-editor-${activeIndex}-${tabs.length}`}
            block
            contentEditableProps={{ className: "min-h-[150px] py-6 outline-none" }}
            getContent={(node) => {
              if ("children" in node && Array.isArray(node.children)) {
                const tabItems = getTabItems(node.children);
                let items = tabItems[activeIndex]?.children ?? [];
                
                // Ensure there is always a paragraph at the top to allow clicking and focuses
                if (items.length === 0 || items[0].type !== "paragraph") {
                  items = [{ type: "paragraph", children: [] }, ...items];
                }
                // Ensure there is always a paragraph at the end to allow clicking and focuses
                if (items.length === 0 || items[items.length - 1].type !== "paragraph") {
                  items = [...items, { type: "paragraph", children: [] }];
                }
                return items;
              }
              return [];
            }}
            getUpdatedMdastNode={(node, children) => {
              if ("children" in node && Array.isArray(node.children)) {
                const tabItems = getTabItems(node.children);
                const rest = getOtherChildren(node.children);
                if (!tabItems[activeIndex]) {
                  return node;
                }
                
                let updatedChildren = [...children];
                // Enforce paragraph at top
                if (updatedChildren.length === 0 || updatedChildren[0].type !== "paragraph") {
                  updatedChildren = [{ type: "paragraph", children: [] }, ...updatedChildren];
                }
                // Enforce paragraph at bottom
                if (updatedChildren.length === 0 || updatedChildren[updatedChildren.length - 1].type !== "paragraph") {
                  updatedChildren = [...updatedChildren, { type: "paragraph", children: [] }];
                }

                const nextTabs = tabItems.map((tab, index) =>
                  index === activeIndex ? { ...tab, children: updatedChildren } : tab
                );
                return {
                  ...node,
                  children: [...nextTabs, ...rest],
                } as any;
              }
              return node;
            }}
          />
        ) : (
          <div className="rounded-md border border-border bg-background px-3 py-6 text-center text-xs text-muted-foreground">
            Add a tab to start editing its content.
          </div>
        )}
      </div>
    </div>
  );
}

function VideoCardEditor(props: JsxEditorProps) {
  const node = props.mdastNode as MdxJsxFlowElement;
  const { title, description, thumbnailSrc, thumbnailText, thumbnailSubtext } =
    getJsxProps(node, [
      "title",
      "description",
      "thumbnailSrc",
      "thumbnailText",
      "thumbnailSubtext",
    ]);
  const resolvedTitle = title || "Video title";
  const resolvedDescription = description || "Short description";

  return (
    <div className="space-y-3">
      <div className="video-card-container" role="presentation">
        <div className="video-card-content">
          <h3>{resolvedTitle}</h3>
          <p>{resolvedDescription}</p>
        </div>
        <div className="video-card-thumbnail-container">
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={resolvedTitle}
              className="video-card-thumbnail"
            />
          ) : (
            <div className="thumbnail-fallback">
              {(thumbnailText || resolvedTitle) && (
                <div className="thumbnail-text">
                  {(thumbnailText || resolvedTitle).slice(0, 15)}
                </div>
              )}
              {(thumbnailSubtext || resolvedDescription) && (
                <div className="thumbnail-subtext">
                  {(thumbnailSubtext || resolvedDescription).slice(0, 15)}
                </div>
              )}
              <svg
                width="36"
                height="36"
                viewBox="0 0 72 72"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M36 69C54.2254 69 69 54.2254 69 36C69 17.7746 54.2254 3 36 3C17.7746 3 3 17.7746 3 36C3 54.2254 17.7746 69 36 69Z"
                  fill="currentColor"
                />
                <path
                  d="M52.1716 38.6337L28.4366 51.5801C26.4374 52.6705 24 51.2235 24 48.9464V23.0536C24 20.7764 26.4374 19.3295 28.4366 20.4199L52.1716 33.3663C54.2562 34.5034 54.2562 37.4966 52.1716 38.6337Z"
                  fill="#ffffff"
                />
              </svg>
            </div>
          )}
        </div>
      </div>
      <GenericJsxEditor {...props} />
    </div>
  );
}

function AcademyCardEditor(props: JsxEditorProps) {
  const node = props.mdastNode as MdxJsxFlowElement;
  const { title, description, academyLink } = getJsxProps(node, [
    "title",
    "description",
    "academyLink",
  ]);
  const resolvedTitle = title || "Academy topic";
  const resolvedDescription = description || "Short description";
  const showBody = (node.children?.length ?? 0) > 0;

  return (
    <div className="space-y-3">
      <div className="academy-card-container">
        <div className="academy-card-header">
          <div className="academy-card-text">
            <h3>{resolvedTitle}</h3>
            <p>{resolvedDescription}</p>
          </div>
          <div className="academy-card-action">
            <span className="academy-card-link">
              <img
                width="32"
                height="32"
                src="/img/icon/acd-icon.svg"
                alt="Academy Icon"
              />
              <span>{academyLink ? "View on Academy" : "Add Academy link"}</span>
            </span>
          </div>
        </div>
        {showBody && (
          <div className="academy-card-body">
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Body content appears in the editor below.
            </div>
          </div>
        )}
      </div>
      <GenericJsxEditor {...props} />
    </div>
  );
}

type DocsComponentKey = "tabs" | "videoCard" | "academyCard";

type PropField = {
  name: string;
  label: string;
  type: "text" | "file";
  required?: boolean;
  placeholder?: string;
  accept?: string;
  helper?: string;
};

const DOCS_COMPONENTS: {
  key: DocsComponentKey;
  label: string;
  description: string;
}[] = [
  {
    key: "tabs",
    label: "Tabs",
    description: "Tabbed content blocks",
  },
  {
    key: "videoCard",
    label: "Video Card",
    description: "Linked video preview card",
  },
  {
    key: "academyCard",
    label: "Academy Card",
    description: "Academy callout card",
  },
];

const COMPONENT_FIELDS: Record<DocsComponentKey, PropField[]> = {
  tabs: [],
  videoCard: [
    {
      name: "videoUrl",
      label: "Video URL",
      type: "text",
      required: true,
      placeholder: "https://...",
    },
    {
      name: "title",
      label: "Title",
      type: "text",
      required: true,
      placeholder: "Video title",
    },
    {
      name: "description",
      label: "Description",
      type: "text",
      required: true,
      placeholder: "Short description",
    },
    {
      name: "thumbnailSrc",
      label: "Thumbnail",
      type: "file",
      required: false,
      placeholder: "Paste an image URL or upload",
      accept: "image/*",
      helper: "Optional. Upload an image or paste a URL.",
    },
    {
      name: "thumbnailText",
      label: "Thumbnail Text",
      type: "text",
      required: false,
      placeholder: "Fallback text",
    },
    {
      name: "thumbnailSubtext",
      label: "Thumbnail Subtext",
      type: "text",
      required: false,
      placeholder: "Secondary fallback text",
    },
  ],
  academyCard: [
    {
      name: "title",
      label: "Title",
      type: "text",
      required: true,
      placeholder: "Academy topic",
    },
    {
      name: "description",
      label: "Description",
      type: "text",
      required: true,
      placeholder: "Short description",
    },
    {
      name: "academyLink",
      label: "Academy Link",
      type: "text",
      required: true,
      placeholder: "https://...",
    },
  ],
};

const DEFAULT_TABS = ["Tab 1", "Tab 2"];

type UploadAsset = (file: File) => Promise<string>;

export function DocsComponentsToolbar({
  uploadAsset,
}: {
  uploadAsset: UploadAsset;
}) {
  const insertJsx = usePublisher(insertJsx$);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedComponent, setSelectedComponent] = React.useState<
    DocsComponentKey | null
  >(null);
  const [formValues, setFormValues] = React.useState<Record<string, string>>({});
  const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});
  const [uploading, setUploading] = React.useState<Record<string, boolean>>({});
  const [tabs, setTabs] = React.useState<string[]>(DEFAULT_TABS);

  const menuItems = React.useMemo(
    () =>
      DOCS_COMPONENTS.map((component) => ({
        value: component.key,
        label: component.label,
      })),
    []
  );

  const openDialogFor = (key: DocsComponentKey) => {
    setSelectedComponent(key);
    setDialogOpen(true);
    setFormErrors({});
    setUploading({});
    if (key === "tabs") {
      setTabs(DEFAULT_TABS);
      setFormValues({});
      return;
    }
    const fields = COMPONENT_FIELDS[key];
    const initialValues = fields.reduce<Record<string, string>>((acc, field) => {
      acc[field.name] = "";
      return acc;
    }, {});
    setFormValues(initialValues);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedComponent(null);
  };

  const handleFileUpload = async (name: string, file?: File | null) => {
    if (!file) return;
    setUploading((prev) => ({ ...prev, [name]: true }));
    setFormErrors((prev) => ({ ...prev, [name]: "" }));
    try {
      const url = await uploadAsset(file);
      setFormValues((prev) => ({ ...prev, [name]: url }));
    } catch (error) {
      setFormErrors((prev) => ({
        ...prev,
        [name]:
          error instanceof Error ? error.message : "Failed to upload file",
      }));
    } finally {
      setUploading((prev) => ({ ...prev, [name]: false }));
    }
  };

  const validateProps = () => {
    if (!selectedComponent || selectedComponent === "tabs") {
      return true;
    }
    const fields = COMPONENT_FIELDS[selectedComponent];
    const errors: Record<string, string> = {};
    fields.forEach((field) => {
      if (field.required && !formValues[field.name]?.trim()) {
        errors[field.name] = "Required";
      }
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const insertComponent = () => {
    if (!selectedComponent) return;

    if (selectedComponent === "tabs") {
      const cleanedTabs = tabs
        .map((name, index) => (name.trim() ? name.trim() : `Tab ${index + 1}`))
        .filter(Boolean);
      const effectiveTabs =
        cleanedTabs.length > 0 ? cleanedTabs : ["Tab 1"];
      const tabNodes = effectiveTabs.map((name) => createTabItem(name));
      insertJsx({
        name: "TabsWrapper",
        kind: "flow",
        props: {},
        children: tabNodes as any,
      });
      closeDialog();
      return;
    }

    if (!validateProps()) {
      return;
    }

    const props = Object.entries(formValues).reduce<Record<string, string>>(
      (acc, [name, value]) => {
        if (value.trim() !== "") {
          acc[name] = value.trim();
        }
        return acc;
      },
      {}
    );

    if (selectedComponent === "videoCard") {
      insertJsx({
        name: "VideoCard",
        kind: "flow",
        props,
      });
    }

    if (selectedComponent === "academyCard") {
      insertJsx({
        name: "AcademyCard",
        kind: "flow",
        props,
        children: [],
      });
    }

    closeDialog();
  };

  const activeComponentMeta = selectedComponent
    ? DOCS_COMPONENTS.find((component) => component.key === selectedComponent)
    : null;

  const isUploading = Object.values(uploading).some(Boolean);

  return (
    <>
      <ButtonOrDropdownButton
        title="Docs Components"
        items={menuItems}
        onChoose={(value) => openDialogFor(value as DocsComponentKey)}
      >
        <span className="text-xs font-medium">Docs Components</span>
      </ButtonOrDropdownButton>

      <DialogPrimitive.Root
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedComponent(null);
          }
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <DialogPrimitive.Content
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-5 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <DialogPrimitive.Title className="text-sm font-semibold">
                {activeComponentMeta
                  ? `Insert ${activeComponentMeta.label}`
                  : "Insert component"}
              </DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="rounded-md border border-border p-1 text-muted-foreground hover:bg-muted"
                  onClick={closeDialog}
                >
                  <CloseIcon className="size-4" />
                </button>
              </DialogPrimitive.Close>
            </div>

            {selectedComponent === "tabs" && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Configure tab names and count. You can reorder or edit content
                  after inserting.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-border rounded-md">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="px-2 py-1 text-left font-semibold">
                          Tab name
                        </th>
                        <th className="px-2 py-1 text-right font-semibold">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tabs.map((tabName, index) => (
                        <tr key={`${tabName}-${index}`}>
                          <td className="px-2 py-1">
                            <input
                              type="text"
                              className="w-full rounded-sm border border-border bg-background px-2 py-1 text-xs"
                              value={tabName}
                              onChange={(event) => {
                                const nextTabs = [...tabs];
                                nextTabs[index] = event.target.value;
                                setTabs(nextTabs);
                              }}
                              placeholder={`Tab ${index + 1}`}
                            />
                          </td>
                          <td className="px-2 py-1 text-right">
                            <button
                              type="button"
                              className="inline-flex items-center rounded-sm border border-border bg-background p-1 text-destructive hover:bg-destructive/10"
                              onClick={() =>
                                setTabs(tabs.filter((_, i) => i !== index))
                              }
                              aria-label="Remove tab"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {tabs.length === 0 && (
                        <tr>
                          <td
                            colSpan={2}
                            className="px-2 py-3 text-center text-xs text-muted-foreground"
                          >
                            No tabs yet. Add one below.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
                  onClick={() => setTabs([...tabs, `Tab ${tabs.length + 1}`])}
                >
                  <Plus className="size-3" />
                  Add tab
                </button>
              </div>
            )}

            {selectedComponent && selectedComponent !== "tabs" && (
              <div className="mt-4 space-y-4">
                {COMPONENT_FIELDS[selectedComponent].map((field) => (
                  <div key={field.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold">
                        {field.label}
                      </label>
                      <span
                        className={
                          field.required
                            ? "text-[10px] font-semibold text-destructive"
                            : "text-[10px] text-muted-foreground"
                        }
                      >
                        {field.required ? "Required" : "Optional"}
                      </span>
                    </div>
                    {field.type === "file" ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          className="w-full rounded-sm border border-border bg-background px-2 py-1 text-xs"
                          placeholder={field.placeholder}
                          value={formValues[field.name] ?? ""}
                          onChange={(event) =>
                            setFormValues((prev) => ({
                              ...prev,
                              [field.name]: event.target.value,
                            }))
                          }
                        />
                        <input
                          type="file"
                          className="text-xs"
                          accept={field.accept}
                          onChange={(event) =>
                            handleFileUpload(
                              field.name,
                              event.target.files?.[0]
                            )
                          }
                        />
                        {field.helper && (
                          <p className="text-[10px] text-muted-foreground">
                            {field.helper}
                          </p>
                        )}
                        {uploading[field.name] && (
                          <p className="text-[10px] text-muted-foreground">
                            Uploading...
                          </p>
                        )}
                      </div>
                    ) : (
                      <input
                        type="text"
                        className="w-full rounded-sm border border-border bg-background px-2 py-1 text-xs"
                        placeholder={field.placeholder}
                        value={formValues[field.name] ?? ""}
                        onChange={(event) =>
                          setFormValues((prev) => ({
                            ...prev,
                            [field.name]: event.target.value,
                          }))
                        }
                      />
                    )}
                    {formErrors[field.name] && (
                      <p className="text-[10px] text-destructive">
                        {formErrors[field.name]}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                onClick={closeDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                onClick={insertComponent}
                disabled={isUploading}
              >
                Insert
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

export const docsComponentDescriptors: JsxComponentDescriptor[] = [
  {
    name: "TabsWrapper",
    kind: "flow",
    source: TAB_COMPONENT_SOURCE,
    props: [],
    hasChildren: true,
    Editor: TabsWrapperEditor,
  },
  {
    name: "TabItem",
    kind: "flow",
    source: TAB_COMPONENT_SOURCE,
    props: [{ name: "name", type: "string", required: true }],
    hasChildren: true,
    Editor: GenericJsxEditor,
  },
  {
    name: "VideoCard",
    kind: "flow",
    source: VIDEO_CARD_SOURCE,
    defaultExport: true,
    props: [
      { name: "videoUrl", type: "string", required: true },
      { name: "title", type: "string", required: true },
      { name: "description", type: "string", required: true },
      { name: "thumbnailSrc", type: "string" },
      { name: "thumbnailText", type: "string" },
      { name: "thumbnailSubtext", type: "string" },
    ],
    hasChildren: false,
    Editor: VideoCardEditor,
  },
  {
    name: "AcademyCard",
    kind: "flow",
    source: ACADEMY_CARD_SOURCE,
    defaultExport: true,
    props: [
      { name: "title", type: "string", required: true },
      { name: "description", type: "string", required: true },
      { name: "academyLink", type: "string", required: true },
    ],
    hasChildren: true,
    Editor: AcademyCardEditor,
  },
];
