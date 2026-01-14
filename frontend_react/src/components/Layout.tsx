import React, { ReactNode } from 'react';
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
            <main className="content flex-1 w-full lg:ml-16 overflow-x-hidden">
                {children}
            </main>
        </div>
    );
};
