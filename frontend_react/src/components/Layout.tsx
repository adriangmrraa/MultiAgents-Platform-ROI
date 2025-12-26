import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';

interface LayoutProps {
    children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="glass-container flex-col lg:flex-row pb-20 lg:pb-5">
            <Sidebar />
            <main className="content flex-1 w-full overflow-x-hidden">
                {children}
            </main>
        </div>
    );
};
