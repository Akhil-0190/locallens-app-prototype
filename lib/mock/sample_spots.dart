import '../models/spot_card.dart';

final List<SpotCard> mockSampleSpots = [
  SpotCard(
    id: 'spot_01',
    mapsLink: 'https://maps.google.com/?q=Mylapore+Tank+Chennai',
    infoParagraph:
    'Tucked two lanes behind the historic temple tank, this tiny family stall serves crispy evening bajjis and filter coffee. Look for the blue wooden shutter.',
    photoUrls: [],
    spotName: 'Corner Filter Coffee & Bajji Stall',
    openHours: '4:30 PM - 8:30 PM',
    practicalTips: 'Cash preferred. Best visited before 6:00 PM rush.',
    greetingCard: 'Vanakkam! Oru filter coffee, please.',
    hourlyLimit: 6,
    currentVisitors: 4, // 2 slots left (fits Solo & 2 Travelers)
    vibeTags: ['Street Food', 'Heritage', 'Local Coffee'],
  ),
  SpotCard(
    id: 'spot_02',
    mapsLink: 'https://maps.google.com/?q=Kapaleeshwarar+Temple+Chennai',
    infoParagraph:
    'A quiet courtyard brass workshop where third-generation artisans hand-carve traditional lamps. Visitors are welcome to watch from the doorway.',
    photoUrls: [],
    spotName: 'Heritage Brass Craft Courtyard',
    openHours: '10:00 AM - 6:00 PM',
    practicalTips: 'Ask politely before taking close-up photos.',
    greetingCard: 'Vanakkam! Ungal velai romba azhaga irukku.',
    hourlyLimit: 8,
    currentVisitors: 3, // 5 slots left (fits up to 4 Travelers)
    vibeTags: ['Local Crafts', 'Heritage', 'Slow Pace'],
  ),
  SpotCard(
    id: 'spot_03',
    mapsLink: 'https://maps.google.com/?q=Luz+Church+Road+Mylapore+Chennai',
    infoParagraph:
    'A second-floor heritage reading room above an old tiffin lane, stocked with out-of-print Tamil history books and a breezy veranda.',
    photoUrls: [],
    spotName: 'Banyan Veranda Book & Print Nook',
    openHours: '11:00 AM - 7:00 PM',
    practicalTips: 'Leave footwear on the wooden rack downstairs.',
    greetingCard: 'Vanakkam! Ulle varalama?',
    hourlyLimit: 5,
    currentVisitors: 4, // 1 slot left (fits Solo Traveler ONLY)
    vibeTags: ['Heritage', 'Street Food', 'Quiet Walk'],
  ),
  SpotCard(
    id: 'spot_04',
    mapsLink: 'https://maps.google.com/?q=Triplicane+High+Road+Chennai',
    infoParagraph:
    'Hidden inside a century-old spice lane, this third-generation roastery grinds fresh filter coffee blends and serves warm cardamom milk.',
    photoUrls: [],
    spotName: 'Spice Lane Roastery & Milk Bar',
    openHours: '6:30 AM - 8:00 PM',
    practicalTips: 'Ask for the medium-roast chicory blend.',
    greetingCard: 'Vanakkam! Fresh coffee powder irukka?',
    hourlyLimit: 6,
    currentVisitors: 3, // 3 slots left (fits 1, 2, or 3 Travelers)
    vibeTags: ['Street Food', 'Heritage', 'Local Coffee'],
  ),
  SpotCard(
    id: 'spot_05',
    mapsLink: 'https://maps.google.com/?q=Marina+Beach+Chennai',
    infoParagraph:
    'Popular sunset sundal cart near the lighthouse promenade. Frequently hits maximum hourly crowd cap during evening hours.',
    photoUrls: [],
    spotName: 'Lighthouse Promenade Sundal Cart',
    openHours: '4:00 PM - 9:00 PM',
    practicalTips: 'High evening footfall; best skipped when crowded.',
    greetingCard: 'Vanakkam! Oru plate sundal.',
    hourlyLimit: 6,
    currentVisitors: 6, // 0 slots left (Full - skipped for everyone)
    vibeTags: ['Street Food', 'Heritage'],
  ),
  SpotCard(
    id: 'spot_06',
    mapsLink: 'https://maps.google.com/?q=Kosapet+Pottery+Town+Chennai',
    infoParagraph:
    'An open-air clay lane where local potters shape terracotta water pots and painted lamps on traditional wheels.',
    photoUrls: [],
    spotName: 'Pottery Kiln & Terracotta Alley',
    openHours: '9:00 AM - 5:30 PM',
    practicalTips: 'Morning hours are coolest for watching wheel work.',
    greetingCard: 'Vanakkam! Ungal paanai velai super.',
    hourlyLimit: 8,
    currentVisitors: 2, // 6 slots left (fits up to 4 Travelers)
    vibeTags: ['Local Crafts', 'Heritage', 'Quiet Walk'],
  ),
  SpotCard(
    id: 'spot_07',
    mapsLink: 'https://maps.google.com/?q=Mylapore+Flower+Market+Chennai',
    infoParagraph:
    'Tucked beside the north arcade, senior weavers string fragrant jasmine and lotus garlands by hand before temple rituals.',
    photoUrls: [],
    spotName: 'North Arcade Jasmine & Garland Lane',
    openHours: '6:00 AM - 11:00 AM',
    practicalTips: 'Visit before 9:00 AM for the freshest blooms.',
    greetingCard: 'Vanakkam! Mallipoo evlo?',
    hourlyLimit: 6,
    currentVisitors: 2, // 4 slots left (fits up to 4 Travelers)
    vibeTags: ['Local Crafts', 'Slow Pace', 'Heritage'],
  ),
  SpotCard(
    id: 'spot_08',
    mapsLink: 'https://maps.google.com/?q=Mandaveli+Market+Chennai',
    infoParagraph:
    'A family-run courtyard tiffin room serving steaming idlis, sambar, and podi dosa on fresh banana leaves with zero signage outside.',
    photoUrls: [],
    spotName: 'Old Courtyard Banana Leaf Tiffin Room',
    openHours: '7:30 AM - 10:30 AM',
    practicalTips: 'Cash only; arrives hot in small batches.',
    greetingCard: 'Vanakkam! Oru plate idli sambar.',
    hourlyLimit: 8,
    currentVisitors: 4, // 4 slots left (fits up to 4 Travelers)
    vibeTags: ['Street Food', 'Local Coffee', 'Slow Pace'],
  ),
  SpotCard(
    id: 'spot_09',
    mapsLink: 'https://maps.google.com/?q=Anna+Salai+Chennai',
    infoParagraph:
    'Large multi-floor commercial gift showroom catering to tour buses with inflated prices.',
    photoUrls: [],
    spotName: 'Commercial Main Road Souvenir Emporium',
    openHours: '10:00 AM - 9:00 PM',
    practicalTips: 'Skip - commercial tourist trap.',
    greetingCard: '',
    isTouristTrap: true,
    hourlyLimit: 20,
    currentVisitors: 2,
    vibeTags: ['Local Crafts', 'Heritage'],
  ),
  SpotCard(
    id: 'spot_10',
    mapsLink: 'https://maps.google.com/?q=East+Coast+Road+Chennai',
    infoParagraph:
    'Ticketed artificial heritage village with packaged food stalls and heavy weekend crowds.',
    photoUrls: [],
    spotName: 'Highway Packaged Heritage Theme Park',
    openHours: '10:00 AM - 7:00 PM',
    practicalTips: 'Skip - commercial tourist trap.',
    greetingCard: '',
    isTouristTrap: true,
    hourlyLimit: 30,
    currentVisitors: 5,
    vibeTags: ['Heritage', 'Street Food'],
  ),
];