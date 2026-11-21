import '../models/spot_card.dart';

final List<SpotCard> mockSampleSpots = [
  SpotCard(
    id: 'spot_01',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Central+Tiffin+Room+Malleshwaram+Bengaluru',
    infoParagraph:
        'Tucked two lanes behind the historic temple tank, this tiny family stall serves crispy evening bajjis and piping hot filter coffee. Look for the blue wooden shutter.',
    photoUrls: [
      'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Corner Filter Coffee & Bajji Stall',
    openHours: '4:30 PM - 8:30 PM',
    practicalTips: 'Cash preferred. Best visited before 6:00 PM rush.',
    greetingCard: 'Namaskara! Oru filter coffee, please.',
    hourlyLimit: 6,
    currentVisitors: 4,
    vibeTags: ['Street Food', 'Heritage', 'Local Coffee'],
  ),
  SpotCard(
    id: 'spot_02',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Heritage+Brass+Makers+Malleshwaram+Bengaluru',
    infoParagraph:
        'A quiet courtyard brass workshop where third-generation artisans hand-carve traditional lamps. Visitors are welcome to watch from the doorway.',
    photoUrls: [
      'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Heritage Brass Craft Courtyard',
    openHours: '10:00 AM - 6:00 PM',
    practicalTips: 'Ask politely before taking close-up photos.',
    greetingCard: 'Namaskara! Beautiful traditional workmanship.',
    hourlyLimit: 8,
    currentVisitors: 3,
    vibeTags: ['Local Crafts', 'Heritage', 'Slow Pace'],
  ),
  SpotCard(
    id: 'spot_03',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Margosa+Road+Malleshwaram+Bengaluru',
    infoParagraph:
        'A second-floor heritage reading room above an old tiffin lane, stocked with out-of-print local history books and a breezy veranda.',
    photoUrls: [
      'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Banyan Veranda Book & Print Nook',
    openHours: '11:00 AM - 7:00 PM',
    practicalTips: 'Leave footwear on the wooden rack downstairs.',
    greetingCard: 'Namaskara! Welcome to the reading veranda.',
    hourlyLimit: 5,
    currentVisitors: 4,
    vibeTags: ['Heritage', 'Street Food', 'Quiet Walk'],
  ),
  SpotCard(
    id: 'spot_04',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Filter+Coffee+Roastery+Malleshwaram+Bengaluru',
    infoParagraph:
        'Hidden inside a century-old spice lane, this third-generation roastery grinds fresh filter coffee blends and serves warm cardamom milk.',
    photoUrls: [
      'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Spice Lane Roastery & Milk Bar',
    openHours: '6:30 AM - 8:00 PM',
    practicalTips: 'Ask for the medium-roast chicory blend.',
    greetingCard: 'Namaskara! Freshly ground coffee ready.',
    hourlyLimit: 6,
    currentVisitors: 3,
    vibeTags: ['Street Food', 'Heritage', 'Local Coffee'],
  ),
  SpotCard(
    id: 'spot_05',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Sankey+Tank+Malleshwaram+Bengaluru',
    infoParagraph:
        'Popular evening snack cart near the promenade. Frequently hits maximum hourly crowd cap during sunset hours.',
    photoUrls: [
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Promenade Sundal & Corn Cart',
    openHours: '4:00 PM - 9:00 PM',
    practicalTips: 'High evening footfall; check capacity before heading over.',
    greetingCard: 'Namaskara! Warm masala corn.',
    hourlyLimit: 6,
    currentVisitors: 6,
    vibeTags: ['Street Food', 'Heritage'],
  ),
  SpotCard(
    id: 'spot_06',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Pottery+Town+Bengaluru',
    infoParagraph:
        'An open-air clay lane where local potters shape terracotta water pots and painted lamps on traditional wheels.',
    photoUrls: [
      'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Pottery Kiln & Terracotta Alley',
    openHours: '9:00 AM - 5:30 PM',
    practicalTips: 'Morning hours are coolest for watching wheel work.',
    greetingCard: 'Namaskara! Traditional pottery craft.',
    hourlyLimit: 8,
    currentVisitors: 2,
    vibeTags: ['Local Crafts', 'Heritage', 'Quiet Walk'],
  ),
  SpotCard(
    id: 'spot_07',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Malleshwaram+Market+Flower+Lane+Bengaluru',
    infoParagraph:
        'Tucked beside the north arcade, senior weavers string fragrant jasmine and lotus garlands by hand before temple rituals.',
    photoUrls: [
      'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'North Arcade Jasmine & Garland Lane',
    openHours: '6:00 AM - 11:00 AM',
    practicalTips: 'Visit before 9:00 AM for the freshest blooms.',
    greetingCard: 'Namaskara! Fragrant fresh jasmine.',
    hourlyLimit: 6,
    currentVisitors: 2,
    vibeTags: ['Local Crafts', 'Slow Pace', 'Heritage'],
  ),
  SpotCard(
    id: 'spot_08',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Veena+Stores+Malleshwaram+Bengaluru',
    infoParagraph:
        'A family-run courtyard tiffin room serving steaming idlis, sambar, and podi dosa on fresh banana leaves with zero signage outside.',
    photoUrls: [
      'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Old Courtyard Banana Leaf Tiffin Room',
    openHours: '7:30 AM - 10:30 AM',
    practicalTips: 'Cash only; arrives hot in small batches.',
    greetingCard: 'Namaskara! Hot soft idlis with chutney.',
    hourlyLimit: 8,
    currentVisitors: 4,
    vibeTags: ['Street Food', 'Local Coffee', 'Slow Pace'],
  ),
  SpotCard(
    id: 'spot_09',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Commercial+Street+Bengaluru',
    infoParagraph:
        'Large multi-floor commercial gift showroom catering to tour buses with inflated prices.',
    photoUrls: [
      'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?w=600&auto=format&fit=crop&q=80',
    ],
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
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Wonderla+Bengaluru',
    infoParagraph:
        'Ticketed artificial heritage village with packaged food stalls and heavy weekend crowds.',
    photoUrls: [
      'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Highway Packaged Heritage Theme Park',
    openHours: '10:00 AM - 7:00 PM',
    practicalTips: 'Skip - commercial tourist trap.',
    greetingCard: '',
    isTouristTrap: true,
    hourlyLimit: 30,
    currentVisitors: 5,
    vibeTags: ['Heritage', 'Street Food'],
  ),
  // Basavanagudi Gems
  SpotCard(
    id: 'spot_bg_01',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Vidyarthi+Bhavan+Gandhi+Bazaar+Basavanagudi+Bengaluru',
    infoParagraph:
        'Iconic heritage tiffin hall open since 1943. Wait for the bell to ring and watch waiters balance towers of crispy ghee masala dosas.',
    photoUrls: [
      'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Vidyarthi Bhavan Heritage Dosa Hall',
    openHours: '6:30 AM - 11:30 AM, 2:00 PM - 8:00 PM',
    practicalTips: 'Peak rush on weekend mornings; arrive early or expect a 20-min token wait.',
    greetingCard: 'Namaskara! Ondu masala dosa, swalpa bega.',
    hourlyLimit: 8,
    currentVisitors: 4,
    vibeTags: ['Street Food', 'Heritage', 'Local Coffee'],
  ),
  SpotCard(
    id: 'spot_bg_02',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Brahmin+Coffee+Bar+Shankarpuram+Basavanagudi+Bengaluru',
    infoParagraph:
        'A standing-only corner spot beloved for melt-in-mouth idlis, crispy vada with coconut chutney, and piping hot filter coffee.',
    photoUrls: [
      'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Corner Filter Coffee & Idli Spot',
    openHours: '6:00 AM - 12:00 PM, 3:00 PM - 7:00 PM',
    practicalTips: 'Stand by the tree outside. No sambar served here—pure traditional green chutney.',
    greetingCard: 'Namaskara! Ondu idli vada combo.',
    hourlyLimit: 6,
    currentVisitors: 3,
    vibeTags: ['Street Food', 'Local Coffee', 'Slow Pace'],
  ),
  SpotCard(
    id: 'spot_bg_03',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Gandhi+Bazaar+Flower+Market+Basavanagudi+Bengaluru',
    infoParagraph:
        'Centuries-old market alley fragrant with marigolds, davana, and fresh seasonal fruits under the shade of ancient rain trees.',
    photoUrls: [
      'https://images.unsplash.com/photo-1582794543139-8ac9cb0f7b11?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Gandhi Bazaar Heritage Flower Lane',
    openHours: '7:00 AM - 9:00 PM',
    practicalTips: 'Walk slowly along the inner pavement for the best street aroma.',
    greetingCard: 'Namaskara! Fresh flowers and incense.',
    hourlyLimit: 8,
    currentVisitors: 3,
    vibeTags: ['Local Crafts', 'Heritage', 'Quiet Walk'],
  ),
  // Indiranagar Cultural Spots
  SpotCard(
    id: 'spot_in_01',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Chinmaya+Mission+Hospital+Road+Indiranagar+Bengaluru',
    infoParagraph:
        'A tranquil, hidden courtyard cafe in a shaded residential cross lane, offering pour-over single estate coffees and handwritten zines.',
    photoUrls: [
      'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Indiranagar Hidden Shaded Roastery',
    openHours: '8:00 AM - 9:00 PM',
    practicalTips: 'Quiet work and reading friendly. Excellent monsoon balcony seats.',
    greetingCard: 'Hello! Welcome to our quiet courtyard.',
    hourlyLimit: 6,
    currentVisitors: 2,
    vibeTags: ['Local Coffee', 'Quiet Walk', 'Slow Pace'],
  ),
  // Old Delhi Heritage Gems
  SpotCard(
    id: 'spot_dl_01',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Paranthe+Wali+Gali+Chandni+Chowk+Old+Delhi',
    infoParagraph:
        'Historic 1870s alley lined with generational fry shops making crispy stuffed paranthas served with sweet pumpkin curry and tangy mint dip.',
    photoUrls: [
      'https://images.unsplash.com/photo-1601050690597-df0568f70950?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Paranthe Wali Gali Generational Kitchen',
    openHours: '9:00 AM - 11:00 PM',
    practicalTips: 'Try the rabri parantha or mooli parantha. Pure vegetarian traditional ghee preparation.',
    greetingCard: 'Namaste! Ek rabri parantha garam garam.',
    hourlyLimit: 8,
    currentVisitors: 4,
    vibeTags: ['Street Food', 'Heritage', 'Slow Pace'],
  ),
  // Fort Kochi Spices & Coastal Heritage
  SpotCard(
    id: 'spot_fk_01',
    mapsLink: 'https://www.google.com/maps/search/?api=1&query=Jew+Town+Road+Mattancherry+Fort+Kochi+Kerala',
    infoParagraph:
        'A winding historic lane of Dutch-era warehouses, aromatic cardamom godowns, and antique carved wood courtyards.',
    photoUrls: [
      'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=600&auto=format&fit=crop&q=80',
    ],
    spotName: 'Jew Town Spice Warehouse & Antiques',
    openHours: '9:30 AM - 6:30 PM',
    practicalTips: 'Best visited late afternoon as the sea breeze rolls in through the spice godowns.',
    greetingCard: 'Namaskaram! Fragrant Malabar spices.',
    hourlyLimit: 6,
    currentVisitors: 2,
    vibeTags: ['Heritage', 'Local Crafts', 'Quiet Walk'],
  ),
];
