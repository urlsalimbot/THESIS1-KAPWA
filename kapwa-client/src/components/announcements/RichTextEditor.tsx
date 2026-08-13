import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Bold, Italic, List, ListOrdered, Heading2, Heading3, Link as LinkIcon,
} from 'lucide-react';
import i18n from '../../i18n';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  className?: string;
}

const ToolbarButton = ({
  active, onClick, children, title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) => (
  <Button
    type="button"
    variant={active ? 'secondary' : 'ghost'}
    size="sm"
    onClick={onClick}
    title={title}
    className="h-8 w-8 p-0"
  >
    {children}
  </Button>
);

export function RichTextEditor({ value, onChange, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      LinkExtension.configure({
        openOnClick: false,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] px-3 py-2',
      },
    },
  });

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt(i18n.t('announcements.urlPrompt', 'URL'), previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className={cn('border rounded-md', className)}>
      <div className="flex items-center gap-1 border-b px-2 py-1 bg-muted/30">
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title={i18n.t('announcements.bold', 'Bold')}
        >
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title={i18n.t('announcements.italic', 'Italic')}
        >
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title={i18n.t('announcements.heading2', 'Heading 2')}
        >
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title={i18n.t('announcements.heading3', 'Heading 3')}
        >
          <Heading3 size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title={i18n.t('announcements.bulletList', 'Bullet list')}
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title={i18n.t('announcements.numberedList', 'Numbered list')}
        >
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('link')}
          onClick={setLink}
          title={i18n.t('announcements.link', 'Link')}
        >
          <LinkIcon size={16} />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
