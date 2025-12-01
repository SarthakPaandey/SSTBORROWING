export interface Resource {
    _id: string;
    name: string;
    type: 'FACILITY' | 'ROOM' | 'LAB_EQUIPMENT' | 'SPORTS_EQUIPMENT' | 'LIBRARY';
    location?: string;
    capacity?: number;
    description?: string;
    imageUrl?: string;
    rules: {
        requiresApproval?: boolean;
        slotMinutes?: number;
        studentsOnly?: boolean;
    };
    sharedGroupId?: string;
    status: 'ACTIVE' | 'INACTIVE';
}

export interface Booking {
    _id: string;
    userId: string;
    resourceId: string;
    resourceName: string;
    kind: 'FACILITY' | 'ROOM' | 'EQUIPMENT' | 'LIBRARY';
    start: string;
    end: string;
    status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
    approval: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED';
    items?: {
        itemId: string;
        name: string;
        qty: number;
    }[];
    qrIssued?: boolean;
}

export interface User {
    _id: string;
    name: string;
    email: string;
    role: 'STUDENT' | 'FACULTY' | 'ADMIN' | 'GUARD';
}

export interface Block {
    _id: string;
    resourceId: string;
    resourceName?: string;
    start: string;
    end: string;
    reason: string;
    type: 'MAINTENANCE' | 'EVENT';
}

export interface LibraryBook {
    _id: string;
    resourceId: string;
    name: string;
    qtyTotal: number;
    qtyAvailable: number;
    safety?: boolean;
    restricted?: boolean;
}
