interface MarkdownRendererProps {
  content: string;
  className?: string;
}

// Simple markdown renderer that handles basic syntax
// @ts-ignore
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let inCodeBlock = false;
  let codeContent: string[] = [];
  let listItems: string[] = [];
  

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc ml-6 my-4 space-y-2">
          {listItems.map((item, i) => (
            <li key={i} className="ml-2">{item}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const processLine = (line: string, i: number) => {
    // Code blocks
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${i}`} className="bg-gray-900 text-gray-100 p-4 rounded-lg my-4 overflow-x-auto">
            <code>{codeContent.join('\n')}</code>
          </pre>
        );
        codeContent = [];
      }
      inCodeBlock = !inCodeBlock;
      return;
    }
    if (inCodeBlock) {
      codeContent.push(line);
      return;
    }

    // Headers
    if (line.startsWith('# ')) {
      flushList();
      elements.push(<h1 key={i} className="text-3xl font-bold mt-8 mb-4">{line.slice(2)}</h1>);
      return;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(<h2 key={i} className="text-2xl font-bold mt-6 mb-3">{line.slice(3)}</h2>);
      return;
    }
    if (line.startsWith('### ')) {
      flushList();
      elements.push(<h3 key={i} className="text-xl font-bold mt-4 mb-2">{line.slice(4)}</h3>);
      return;
    }
    if (line.startsWith('#### ')) {
      flushList();
      elements.push(<h4 key={i} className="text-lg font-bold mt-4 mb-2">{line.slice(5)}</h4>);
      return;
    }

    // List items
    if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2));
      return;
    }
    
    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      flushList();
      elements.push(
        <p key={i} className="my-4 leading-relaxed">
          <span className="font-bold">{line.match(/^\d+\./)?.[0]} </span>
          {line.replace(/^\d+\.\s/, '')}
        </p>
      );
      return;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote key={i} className="border-l-4 border-gray-300 pl-4 my-4 italic text-gray-600">
          {line.slice(2)}
        </blockquote>
      );
      return;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      flushList();
      elements.push(<hr key={i} className="my-8 border-gray-300" />);
      return;
    }

    // Empty line
    if (line.trim() === '') {
      flushList();
      return;
    }

    // Regular paragraph
    flushList();
    // Handle inline formatting
    const formattedLine = line
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code class="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>');
    
    elements.push(
      <p key={i} className="my-4 leading-relaxed" dangerouslySetInnerHTML={{ __html: formattedLine }} />
    );
  };

  lines.forEach((line, i) => processLine(line, i));
  flushList();

  return (
    <div className={`prose max-w-none ${className}`}>
      {elements}
    </div>
  );
}