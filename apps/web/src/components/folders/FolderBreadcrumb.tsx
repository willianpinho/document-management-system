'use client';

import Link from 'next/link';
import { ChevronRight, Home, Folder } from 'lucide-react';

interface BreadcrumbItem {
  id: string;
  name: string;
  path: string;
}

interface FolderBreadcrumbProps {
  items: BreadcrumbItem[];
  currentName?: string;
}

export function FolderBreadcrumb({ items, currentName }: FolderBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1 text-sm">
      <Link
        href="/documents"
        className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Home className="h-4 w-4" />
        <span className="hidden sm:inline">Documents</span>
      </Link>

      {items.map((item, index) => (
        <div key={item.id} className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          {index === items.length - 1 && !currentName ? (
            <span className="flex items-center gap-1 font-medium">
              <Folder className="h-4 w-4" />
              {item.name}
            </span>
          ) : (
            <Link
              href={`/folders/${item.id}`}
              className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <Folder className="h-4 w-4" />
              {item.name}
            </Link>
          )}
        </div>
      ))}

      {currentName && (
        <div className="flex items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{currentName}</span>
        </div>
      )}
    </nav>
  );
}
