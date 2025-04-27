"use client";

import * as React from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext"; // Assuming logout logic is here

export function Navbar() {
  const { logout } = useAuth(); // Assuming a logout function exists in your AuthContext

  const handleLogout = () => {
    logout(); // Call the logout function from context
    // Optionally redirect user after logout, e.g., router.push('/login');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background border-b">
      <div className="container mx-auto flex h-14 items-center justify-between px-4 md:px-6">
        <Link href="/dashboard" className="mr-6 flex items-center space-x-2">
          {/* You can add a logo or site title here */}
          <span className="font-bold">Superdapp</span>
        </Link>
        <div className="flex items-center space-x-4">
          {/* Add other nav items here if needed */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/portfolio">Portfolio</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/addresses">Addresses</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
} 