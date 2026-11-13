// =========================================================
// menus.js
// Which pages each role can open. The sidebar is built from
// these lists, so adding a page to a role = adding one line here
// (and adding the page to PAGES in App.jsx).
//
// id    -> the key App.jsx uses to find the page
// label -> the text shown in the sidebar
// icon  -> an icon from the lucide-react library
// =========================================================
import {
  LayoutGrid, Calendar, Users, ClipboardList, Stethoscope, Pill, Bell,
  Ear, Send, ScanLine, Wallet,
} from 'lucide-react'

export const MENUS = {
  doctor: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'record', label: 'Patient record', icon: Users },
    { id: 'visit', label: 'Visit details', icon: ClipboardList },
    { id: 'consultation', label: 'Consultation', icon: Stethoscope },
    { id: 'prescription', label: 'Prescriptions', icon: Pill },
    { id: 'followup', label: 'Follow-up alerts', icon: Bell },
    { id: 'hearing', label: 'Hearing tools', icon: Ear },
    { id: 'referrals', label: 'Referrals', icon: Send },
  ],
  nurse: [
    { id: 'nurse', label: 'Today', icon: LayoutGrid },
    { id: 'scan', label: 'Document scan', icon: ScanLine },
  ],
  receptionist: [
    { id: 'queue', label: 'Live queue', icon: LayoutGrid },
    { id: 'referrals', label: 'Referrals', icon: Send },
  ],
  owner: [
    { id: 'owner', label: 'Overview', icon: Wallet },
  ],
}

// Name and job title shown at the bottom of the sidebar
export const USERS = {
  doctor: { name: 'Dr. Mohammed', title: 'ENT consultant' },
  nurse: { name: 'Nurse Amira', title: 'Assistant / nurse' },
  receptionist: { name: 'Hana Samir', title: 'Receptionist' },
  owner: { name: 'Clinic owner', title: 'Manager' },
  patient: { name: 'Youssef Adel', title: 'Patient' },
}
