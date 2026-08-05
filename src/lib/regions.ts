// Indian states / UTs with their districts (major districts listed; free text allowed for the rest)
export const INDIAN_REGIONS: Record<string, string[]> = {
  "Andhra Pradesh": ["Anantapur", "Chittoor", "East Godavari", "Guntur", "Krishna", "Kurnool", "Nellore", "Prakasam", "Srikakulam", "Visakhapatnam", "Vizianagaram", "West Godavari", "YSR Kadapa"],
  "Arunachal Pradesh": ["Changlang", "East Siang", "Lohit", "Papum Pare", "Tawang", "West Kameng"],
  Assam: ["Barpeta", "Cachar", "Darrang", "Dhubri", "Dibrugarh", "Golaghat", "Jorhat", "Kamrup", "Nagaon", "Sivasagar", "Sonitpur", "Tinsukia"],
  Bihar: ["Araria", "Begusarai", "Bhagalpur", "Darbhanga", "Gaya", "Gopalganj", "Muzaffarpur", "Nalanda", "Patna", "Purnia", "Rohtas", "Samastipur", "Saran", "Siwan", "Vaishali"],
  Chhattisgarh: ["Bastar", "Bilaspur", "Durg", "Janjgir-Champa", "Korba", "Raigarh", "Raipur", "Rajnandgaon", "Surguja"],
  Goa: ["North Goa", "South Goa"],
  Gujarat: ["Ahmedabad", "Amreli", "Anand", "Banaskantha", "Bhavnagar", "Bharuch", "Jamnagar", "Junagadh", "Kutch", "Mehsana", "Rajkot", "Sabarkantha", "Surat", "Vadodara"],
  Haryana: ["Ambala", "Bhiwani", "Faridabad", "Fatehabad", "Gurugram", "Hisar", "Jind", "Kaithal", "Karnal", "Kurukshetra", "Panipat", "Rohtak", "Sirsa", "Sonipat", "Yamunanagar"],
  "Himachal Pradesh": ["Bilaspur", "Chamba", "Hamirpur", "Kangra", "Kullu", "Mandi", "Shimla", "Sirmaur", "Solan", "Una"],
  Jharkhand: ["Bokaro", "Dhanbad", "Dumka", "East Singhbhum", "Giridih", "Hazaribagh", "Palamu", "Ranchi", "Santhal Pargana"],
  Karnataka: ["Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bidar", "Chikkamagaluru", "Davanagere", "Dharwad", "Gadag", "Hassan", "Haveri", "Kalaburagi", "Kolar", "Koppal", "Mandya", "Mysuru", "Raichur", "Shivamogga", "Tumakuru", "Vijayapura"],
  Kerala: ["Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam", "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thrissur", "Thiruvananthapuram", "Wayanad"],
  "Madhya Pradesh": ["Betul", "Bhopal", "Chhindwara", "Dewas", "Dhar", "Gwalior", "Hoshangabad", "Indore", "Jabalpur", "Khargone", "Rewa", "Sagar", "Satna", "Sehore", "Ujjain", "Vidisha"],
  Maharashtra: ["Ahmednagar", "Akola", "Amravati", "Aurangabad", "Beed", "Buldhana", "Dhule", "Jalgaon", "Kolhapur", "Latur", "Nagpur", "Nanded", "Nashik", "Osmanabad", "Pune", "Sangli", "Satara", "Solapur", "Wardha", "Yavatmal"],
  Manipur: ["Bishnupur", "Imphal East", "Imphal West", "Thoubal", "Churachandpur"],
  Meghalaya: ["East Khasi Hills", "Garo Hills", "Jaintia Hills", "Ri Bhoi"],
  Mizoram: ["Aizawl", "Champhai", "Lunglei", "Kolasib"],
  Nagaland: ["Dimapur", "Kohima", "Mokokchung", "Wokha"],
  Odisha: ["Balasore", "Bargarh", "Bhadrak", "Cuttack", "Ganjam", "Kalahandi", "Keonjhar", "Koraput", "Mayurbhanj", "Puri", "Sambalpur", "Sundargarh"],
  Punjab: ["Amritsar", "Bathinda", "Faridkot", "Fazilka", "Ferozepur", "Gurdaspur", "Hoshiarpur", "Jalandhar", "Kapurthala", "Ludhiana", "Mansa", "Moga", "Muktsar", "Patiala", "Sangrur"],
  Rajasthan: ["Ajmer", "Alwar", "Barmer", "Bharatpur", "Bhilwara", "Bikaner", "Chittorgarh", "Churu", "Ganganagar", "Hanumangarh", "Jaipur", "Jaisalmer", "Jodhpur", "Kota", "Nagaur", "Pali", "Sikar", "Udaipur"],
  Sikkim: ["East Sikkim", "North Sikkim", "South Sikkim", "West Sikkim"],
  "Tamil Nadu": ["Coimbatore", "Cuddalore", "Dharmapuri", "Dindigul", "Erode", "Kanchipuram", "Madurai", "Nagapattinam", "Namakkal", "Salem", "Sivaganga", "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli", "Tiruppur", "Vellore", "Villupuram", "Virudhunagar"],
  Telangana: ["Adilabad", "Karimnagar", "Khammam", "Mahbubnagar", "Medak", "Nalgonda", "Nizamabad", "Rangareddy", "Warangal"],
  Tripura: ["Dhalai", "Gomati", "North Tripura", "West Tripura"],
  "Uttar Pradesh": ["Agra", "Aligarh", "Allahabad (Prayagraj)", "Azamgarh", "Bareilly", "Basti", "Bijnor", "Bulandshahr", "Deoria", "Etawah", "Faizabad (Ayodhya)", "Gorakhpur", "Hardoi", "Jaunpur", "Jhansi", "Kanpur", "Lakhimpur Kheri", "Lucknow", "Mathura", "Meerut", "Moradabad", "Muzaffarnagar", "Pratapgarh", "Rae Bareli", "Saharanpur", "Sitapur", "Sultanpur", "Varanasi"],
  Uttarakhand: ["Almora", "Dehradun", "Haridwar", "Nainital", "Pauri Garhwal", "Udham Singh Nagar"],
  "West Bengal": ["Bankura", "Birbhum", "Burdwan", "Cooch Behar", "Darjeeling", "Hooghly", "Howrah", "Jalpaiguri", "Malda", "Murshidabad", "Nadia", "North 24 Parganas", "Purulia", "South 24 Parganas"],
  "Andaman and Nicobar Islands": ["North and Middle Andaman", "South Andaman", "Nicobar"],
  Chandigarh: ["Chandigarh"],
  "Dadra and Nagar Haveli and Daman and Diu": ["Dadra and Nagar Haveli", "Daman", "Diu"],
  Delhi: ["Central Delhi", "New Delhi", "North Delhi", "South Delhi", "West Delhi"],
  "Jammu and Kashmir": ["Anantnag", "Baramulla", "Budgam", "Jammu", "Kathua", "Pulwama", "Srinagar", "Udhampur"],
  Ladakh: ["Kargil", "Leh"],
  Lakshadweep: ["Lakshadweep"],
  Puducherry: ["Karaikal", "Mahe", "Puducherry", "Yanam"],
};

export const INDIAN_STATES = Object.keys(INDIAN_REGIONS).sort();

export function districtsFor(state?: string | null): string[] {
  if (!state) return [];
  return INDIAN_REGIONS[state] ?? [];
}

export function regionLabel(state?: string | null, district?: string | null): string {
  if (state && district) return `${district}, ${state}, India`;
  if (state) return `${state}, India`;
  return "";
}
