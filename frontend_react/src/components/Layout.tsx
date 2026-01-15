import React, { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { UserProfile } from './UserProfile';

interface LayoutProps {
    children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
    return (
        <div className="glass-container min-h-screen">
            <UserProfile />
            <Sidebar />
            <main className="content flex-1 w-full lg:ml-24 overflow-x-hidden pt-20 lg:pt-6 min-w-0">
                {children}
            </main>
        </div>
    );
};
