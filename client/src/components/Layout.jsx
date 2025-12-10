import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Home, Package, DollarSign, Calendar, PlusCircle, ChevronDown, Users } from 'lucide-react';
import { useState, useEffect } from 'react';
import UserManagementModal from './UserManagementModal';

const Layout = ({ children }) => {
    const { user, logout } = useAuth();
    const location = useLocation();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [userModalOpen, setUserModalOpen] = useState(false);

    useEffect(() => {
        setUserModalOpen(false);
        setDropdownOpen(false);
    }, [location]);

    const navItems = [
        { path: '/calendar', label: 'Disponibilidad', icon: Calendar },
        { path: '/dashboard', label: 'Gestión de reservas', icon: Home },
        { path: '/caja', label: 'Caja', icon: DollarSign },
        { path: '/inventory', label: 'Stock', icon: Package },
        { path: '/new-reservation', label: 'Nueva reserva', icon: PlusCircle },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="sticky top-0 z-50 bg-white shadow-md">
                {/* Header */}
                <header className="bg-white border-b">
                    <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
                        <h1 className="text-2xl font-bold text-gray-800">Gestión Mak Suites</h1>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <button
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium focus:outline-none"
                                >
                                    {user?.name} ({user?.role})
                                    <ChevronDown size={16} />
                                </button>

                                {dropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border">
                                        {user?.role === 'admin' && (
                                            <button
                                                onClick={() => {
                                                    setDropdownOpen(false);
                                                    setUserModalOpen(true);
                                                }}
                                                className="block w-full text-left px-4 py-2 text-sm text-blue-600 hover:bg-gray-100 flex items-center gap-2"
                                            >
                                                <Users size={16} />
                                                Gestionar Usuarios
                                            </button>
                                        )}
                                        <button
                                            onClick={logout}
                                            className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center gap-2"
                                        >
                                            <LogOut size={16} />
                                            Cerrar Sesión
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Navigation */}
                <nav className="bg-white">
                    <div className="max-w-7xl mx-auto px-4">
                        <div className="flex items-center">
                            <div className="flex space-x-8">
                                {navItems.filter(item => item.path !== '/new-reservation').map((item) => {
                                    const Icon = item.icon;
                                    const isActive = location.pathname === item.path;
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={`flex items-center gap-2 py-4 px-2 border-b-2 transition ${isActive
                                                ? 'border-blue-600 text-blue-600 font-semibold'
                                                : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                                                }`}
                                        >
                                            <Icon size={20} />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>

                            {/* Nueva Reserva Button - Right Aligned */}
                            <div className="ml-auto">
                                {navItems.filter(item => item.path === '/new-reservation').map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className="flex items-center gap-2 py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 transition font-medium shadow-sm hover:shadow-md transform hover:-translate-y-0.5"
                                        >
                                            <Icon size={20} />
                                            {item.label}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </nav>
            </div>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto">{children}</main>

            <UserManagementModal
                isOpen={userModalOpen}
                onClose={() => setUserModalOpen(false)}
            />
        </div>
    );
};

export default Layout;
