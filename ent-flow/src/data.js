// =========================================================
// data.js
// All the example (fake) data the screens show.
// Later, this is the part you replace with real data coming
// from the backend API. The screens do not need to change much.
// =========================================================

// The patient shown in most doctor screens
export const currentPatient = {
  id: '57685-ENT',
  name: 'Youssef Adel',
  sex: 'Male',
  age: 34,
  dateOfBirth: '12/03/1992',
  phone: '+20 10 1234 5678',
  payer: 'Self-pay',
  language: 'Arabic',
  room: 'Room 2',
  visitTime: '09:00',
  complaint: 'Right ear pain, 3 days',
}

// Allergies are shown in red everywhere
export const allergies = [
  { type: 'Drug', name: 'Penicillin', reaction: 'Rash, moderate' },
  { type: 'Environment', name: 'Dust', reaction: 'Sneezing, nasal blockage' },
]

// Medical history uses three answers: Yes, No, Unknown
export const medicalHistory = [
  { item: 'Recurrent ear infections', answer: 'Yes', detail: 'Right, since childhood' },
  { item: 'Ear or nose surgery', answer: 'No', detail: '' },
  { item: 'Diabetes', answer: 'No', detail: '' },
  { item: 'High blood pressure', answer: 'Unknown', detail: 'Not measured' },
  { item: 'Smoking', answer: 'No', detail: '' },
  { item: 'Hearing aid', answer: 'No', detail: '' },
]

export const medications = [
  { name: 'Xylometazoline 0.1% nasal spray', dose: '2 sprays, twice daily', status: 'Stopped' },
  { name: 'Cetirizine 10 mg', dose: '1 tablet at night', status: 'Continue' },
  { name: 'Ciprofloxacin ear drops', dose: '4 drops, right ear, 7 days', status: 'Completed' },
]

export const previousDiagnoses = [
  { name: 'Otitis externa, right', date: '12/08/2026', status: 'Resolved' },
  { name: 'Allergic rhinitis', date: '03/2024', status: 'Active' },
  { name: 'Acute tonsillitis', date: '11/2024', status: 'Resolved' },
]

// Hearing thresholds in dB for each frequency (audiogram)
export const audiogram = {
  frequencies: ['250', '500', '1k', '2k', '4k', '8k'],
  right: [20, 25, 30, 40, 50, 55],
  left: [15, 15, 20, 20, 25, 30],
}

// Number of patients per hour today (for the bar chart)
export const patientsPerHour = {
  labels: ['9', '10', '11', '12', '1', '2', '3', '4', '5'],
  values: [2, 3, 4, 3, 2, 4, 5, 3, 2],
}

export const followUpAlerts = { red: 2, amber: 5, green: 31 }

// Reception queue for today
export const queue = [
  { time: '09:00', name: 'Youssef Adel', reason: 'Ear', status: 'In visit', room: 'Room 2', intake: 'Complete', wait: '0 min', flag: '' },
  { time: '09:20', name: 'Salma Ibrahim', reason: 'Hearing', status: 'Waiting', room: 'Room 1', intake: 'Complete', wait: '4 min', flag: 'Urgent' },
  { time: '09:40', name: 'Mariam Hassan, 7 y', reason: 'Child, post-op', status: 'Checked in', room: 'Room 2', intake: 'Incomplete', wait: '9 min', flag: 'HIO' },
  { time: '10:00', name: 'Omar Khaled', reason: 'Voice', status: 'Checked in', room: '', intake: 'Not started', wait: '2 min', flag: 'Referral in' },
  { time: '10:20', name: 'Nour Salah', reason: 'Nose', status: 'Booked', room: '', intake: 'Complete', wait: '', flag: 'No-show risk' },
  { time: '10:40', name: 'Karim Fathy', reason: 'Throat', status: 'Booked', room: '', intake: 'Not started', wait: '', flag: '' },
  { time: '11:00', name: 'Laila Mostafa', reason: 'Ear', status: 'Booked', room: '', intake: 'Complete', wait: '', flag: 'Insurance' },
]

// Weekly schedule: one list of appointments per day (name and time only)
export const week = [
  { day: 'Saturday', date: '17/10', slots: [['09:00', 'Ahmed Ezz'], ['09:30', 'Laila Mostafa'], ['10:00', 'Hossam Nabil'], ['11:30', 'Karim Fathy']] },
  { day: 'Sunday', date: '18/10', today: true, slots: [['09:00', 'Youssef Adel'], ['09:30', 'Salma Ibrahim'], ['10:00', 'Mariam Hassan'], ['10:30', 'Omar Khaled'], ['11:00', 'Nour Salah'], ['12:00', 'Tarek Hamdy']] },
  { day: 'Monday', date: '19/10', slots: [['09:00', 'Dina Farouk'], ['09:30', 'Sherif Kamal'], ['10:30', 'Hana Youssef'], ['11:30', 'Aya Mahmoud']] },
  { day: 'Tuesday', date: '20/10', slots: [['09:00', 'Karim Fathy'], ['10:00', 'Ramy Sami'], ['10:30', 'Yara Nabil'], ['12:00', 'Salma Ibrahim']] },
  { day: 'Wednesday', date: '21/10', slots: [['09:00', 'Mahmoud Reda'], ['09:30', 'Heba Samir'], ['11:30', 'Ola Gamal']] },
  { day: 'Thursday', date: '22/10', slots: [['09:30', 'Laila Mostafa'], ['10:00', 'Ziad Amr'], ['12:00', 'Youssef Adel']] },
  { day: 'Friday', date: '23/10', closed: true, slots: [] },
]

// Patients in follow-up programs, sorted from most to least urgent
export const followUps = [
  { name: 'Mariam Hassan, 7 y', program: 'Post-tonsillectomy, day 6', note: 'Note: "a little fresh blood after dinner"', level: 'Red' },
  { name: 'Salma Ibrahim', program: 'Sudden hearing loss, day 4', note: 'Hearing self-rating fell from 6 to 4', level: 'Amber' },
  { name: 'Karim Fathy', program: 'Septoplasty, day 3', note: 'Missed 2 check-ins', level: 'Amber' },
  { name: 'Laila Mostafa', program: 'Ear infection, day 2', note: 'Pain 3, no fever', level: 'Green' },
]

export const revenueByMonth = {
  labels: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'],
  values: [120, 140, 132, 150, 162, 158, 171, 186],
}

export const stockAlerts = [
  { item: 'Ear specula, 4 mm', detail: '12 left, minimum 50', level: 'Low' },
  { item: 'Nasal packing', detail: 'Expires in 9 days', level: 'Soon' },
  { item: 'Saline 500 ml', detail: '18 left, minimum 20', level: 'Low' },
  { item: 'Ear irrigation syringes', detail: '9 left, minimum 10', level: 'Low' },
]

// The drug catalog used by the prescription screen (doses come from here, never typed)
export const drugCatalog = {
  'Ibuprofen suspension 100 mg / 5 ml': ['5 ml', '7.5 ml', '10 ml'],
  'Paracetamol suspension 120 mg / 5 ml': ['7 ml', '9 ml', '11 ml'],
  'Benzydamine throat spray': ['2 sprays', '4 sprays'],
  'Amoxicillin suspension 250 mg / 5 ml': ['5 ml', '7.5 ml', '10 ml'],
}

// Alerts that "arrive" while staff are signed in. Each one pops up as a red
// message. "page" is where the Open button goes (left out if the role cannot open it).
export const incomingAlerts = {
  doctor: [
    { id: 'fu-mariam', title: 'Red follow-up alert', text: 'Mariam Hassan, 7 y, post-tonsillectomy day 6: "a little fresh blood after dinner".', page: 'followup' },
  ],
  receptionist: [
    { id: 'urgent-call', title: 'Urgent request', text: 'Phone call: sudden hearing loss in the left ear since yesterday. Fast-track slot 12:10.', page: 'queue' },
  ],
  nurse: [
    { id: 'fu-mariam', title: 'Red follow-up alert', text: 'Mariam Hassan, 7 y, post-tonsillectomy day 6: "a little fresh blood after dinner". Doctor notified.' },
  ],
}

// Colors the doctor marks findings with on the anatomy pictures
export const findingCategories = [
  { id: 'normal', label: 'Normal', color: '#16a34a' },
  { id: 'abnormal', label: 'Abnormal', color: '#e5484d' },
  { id: 'swelling', label: 'Swelling', color: '#f59e0b' },
  { id: 'lesion', label: 'Lesion / mass', color: '#8b5cf6' },
  { id: 'other', label: 'Other', color: '#2f74d6' },
]

// The three examination areas the doctor can choose in the consultation.
// Pictures live in public/anatomy. "width" is how wide each picture is drawn.
export const examRegions = [
  {
    id: 'ear',
    label: 'Ear',
    icon: '/icons/ear.png',
    hint: 'Outer ears and eardrums (otoscope)',
    views: [
      { id: 'ear-right', label: 'Right ear', img: '/anatomy/ear-right.png', width: 210 },
      { id: 'ear-left', label: 'Left ear', img: '/anatomy/ear-left.png', width: 210 },
      { id: 'tm-right', label: 'Right TM (otoscope)', img: '/anatomy/tm-right.png', width: 150 },
      { id: 'tm-left', label: 'Left TM (otoscope)', img: '/anatomy/tm-left.png', width: 150 },
    ],
    findings: ['Normal', 'Wax (cerumen)', 'Tympanic membrane perforation', 'Retracted tympanic membrane', 'Middle ear effusion', 'Otitis externa', 'Discharge', 'Foreign body'],
    locations: [
      'Right ear, helix', 'Right ear, external canal', 'Right TM, anterior inferior quadrant', 'Right TM, posterior superior quadrant',
      'Left ear, helix', 'Left ear, external canal', 'Left TM, anterior inferior quadrant', 'Left TM, posterior superior quadrant',
      'Mastoid area',
    ],
    previous: [
      { img: '/anatomy/ear-right.png', label: 'Right ear', text: 'Normal', date: '15 Sep 2026' },
      { img: '/anatomy/ear-left.png', label: 'Left ear', text: 'Mild cerumen', date: '15 Sep 2026' },
      { img: '/anatomy/tm-right.png', label: 'Right TM', text: 'Intact', date: '15 Sep 2026' },
      { img: '/anatomy/tm-left.png', label: 'Left TM', text: 'Normal', date: '15 Sep 2026' },
    ],
  },
  {
    id: 'nose',
    label: 'Nose & sinus',
    icon: '/icons/head.png',
    hint: 'Nasal cavity, turbinates, septum and sinuses',
    views: [
      { id: 'nose-anterior', label: 'Anterior view', img: '/anatomy/nose-anterior.png', width: 400 },
      { id: 'nose-sagittal', label: 'Sagittal view (right side)', img: '/anatomy/nose-sagittal.png', width: 370 },
    ],
    findings: ['Normal', 'Mucosal erythema', 'Turbinate hypertrophy', 'Septal deviation', 'Nasal polyp', 'Discharge', 'Crusting', 'Bleeding point'],
    locations: [
      'Nasal cavity, inferior turbinate (right)', 'Nasal cavity, inferior turbinate (left)', 'Middle turbinate (right)', 'Middle turbinate (left)',
      'Nasal septum', 'Maxillary sinus', 'Frontal sinus', 'Ethmoid sinus', 'Sphenoid sinus', 'Nasopharynx',
    ],
    previous: [
      { img: '/anatomy/nose-anterior.png', label: 'Nasal cavity', text: 'Mild congestion', date: '03 Mar 2024' },
    ],
  },
  {
    id: 'throat',
    label: 'Throat & larynx',
    icon: '/icons/mouth.png',
    hint: 'Oral cavity, oropharynx, tonsils and vocal cords',
    views: [
      { id: 'oral-cavity', label: 'Oral cavity (anterior)', img: '/anatomy/oral-cavity.png', width: 245 },
      { id: 'oropharynx', label: 'Oropharynx (posterior)', img: '/anatomy/oropharynx.png', width: 250 },
      { id: 'larynx', label: 'Larynx (from above)', img: '/anatomy/larynx.png', width: 300 },
    ],
    findings: ['Normal', 'Tonsillar hypertrophy', 'Tonsillar exudate', 'Pharyngeal erythema', 'Vocal cord nodule', 'Vocal cord paralysis', 'Leukoplakia', 'Ulcer'],
    locations: [
      'Hard palate', 'Soft palate', 'Uvula', 'Tonsil (right)', 'Tonsil (left)', 'Tongue', 'Posterior pharyngeal wall',
      'Epiglottis', 'True vocal cord (right)', 'True vocal cord (left)', 'False cord',
    ],
    previous: [
      { img: '/anatomy/oropharynx.png', label: 'Tonsils', text: 'Acute tonsillitis, resolved', date: 'Nov 2024' },
    ],
  },
]
