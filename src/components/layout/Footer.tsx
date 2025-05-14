import Link from 'next/link';
import { FileText } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-muted/50 border-t">
      <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
        <p className="text-sm">
          &copy; {new Date().getFullYear()} Kratia Forums. All rights reserved.
        </p>
        <div className="mt-2">
          <Link href="/constitution" className="text-sm hover:text-primary transition-colors inline-flex items-center">
            <FileText className="mr-1 h-4 w-4" />
            Normas y Condiciones (Constitution)
          </Link>
        </div>
      </div>
    </footer>
  );
}