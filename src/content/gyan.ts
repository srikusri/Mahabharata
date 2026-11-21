import { SPACES } from '../engine/board';

/**
 * "Gyan" (learning) cards shown when someone lands on or buys a space, so children pick up the stories,
 * places and objects of the Mahabharata while they play. Content only: no game rules live here.
 *
 * Keyed by the space name on the board. Facts are short and kid-friendly; where the epic and history differ
 * or a place is only "usually identified" with a modern town, the wording says so.
 */
export interface Gyan {
  /** What kind of thing this is, shown as a small label. */
  kind: 'Place' | 'Object' | 'Story' | 'Idea' | 'Event';
  /** Two or three short facts; one is shown each time, chosen by the game's event number so every phone agrees. */
  facts: string[];
  /** A word and its meaning, e.g. "Hastinapura: hasti = elephant, pura = city". */
  word?: string;
  /** Where it is today, as usually identified. */
  today?: string;
}

export const GYAN: Record<string, Gyan> = {
  'Rajasooya Yagna': {
    kind: 'Event',
    facts: [
      'A Rajasuya was a grand ceremony in which a king was honoured as an emperor. Yudhishthira held his at Indraprastha, and kings from many lands came with gifts.',
      "Before the Rajasuya, Yudhishthira's four younger brothers travelled in four directions to win over kings: Arjuna went north, Bhima east, Sahadeva south and Nakula west.",
      'At the Rajasuya, the first honour was given to Krishna. This made King Shishupala so angry that he began to insult Krishna in front of everyone.',
    ],
    word: 'Rajasooya: raja = king, sooya = anointing, so "a royal anointing".',
  },
  Mathura: {
    kind: 'Place',
    facts: [
      "Mathura, on the river Yamuna, is where Krishna was born. His cruel uncle Kamsa had locked Krishna's parents in prison. Krishna later ended Kamsa's rule.",
      'Jarasandha of Magadha attacked Mathura again and again. To keep his people safe, Krishna moved the Yadavas to a new city by the sea: Dwaraka.',
    ],
    today: 'Mathura, Uttar Pradesh',
  },
  Dwaraka: {
    kind: 'Place',
    facts: [
      "Dwaraka was Krishna's city by the western sea. Dwara means door or gate, so its name means \"the gateway\".",
      "At a festival near Dwaraka, Arjuna met Krishna's sister Subhadra. With Krishna's blessing, they were married.",
      'Old stories say Dwaraka was later swallowed by the sea. Divers have found stone structures off the coast of Gujarat, but experts still debate how old they are.',
    ],
    word: 'Dwaraka: dwara = gate.',
    today: 'Dwarka, Gujarat',
  },
  Anarta: {
    kind: 'Place',
    facts: [
      'Anarta was an old kingdom on the western coast of India, in what is now Gujarat. Dwaraka stood in this region.',
      "Gujarat's coast has a very long tradition of sailing and trade. Lothal, a town of the Harappan civilisation in Gujarat, was built about 4,400 years ago. Its huge brick basin is thought by many archaeologists to be an ancient dock, though some think it was a water tank.",
    ],
    today: 'Gujarat',
  },
  Ahichhatra: {
    kind: 'Place',
    facts: [
      'Ahichhatra was the capital of North Panchala. Ahi means snake and chhatra means umbrella: the name comes from a legend of a snake spreading its hood like an umbrella.',
      "After Arjuna and his brothers defeated Drupada for their teacher Drona, Drona took the northern half of Panchala, with Ahichhatra, and Drupada kept the south.",
    ],
    word: 'Ahichhatra: ahi = snake, chhatra = umbrella.',
    today: 'near Bareilly, Uttar Pradesh',
  },
  Kampilya: {
    kind: 'Place',
    facts: [
      "Kampilya was King Drupada's capital in South Panchala. Princess Draupadi's swayamvara, where she would choose her husband, was held here.",
      'To win Draupadi, a prince had to shoot arrows through a spinning wheel and hit a small target high above, aiming by looking at its reflection in water. Arjuna was the one who did it.',
    ],
    today: 'Kampil, Uttar Pradesh',
  },
  'S. Panchala': {
    kind: 'Place',
    facts: [
      'King Drupada of Panchala performed a fire ceremony to ask for a son. From the flames came Dhrishtadyumna and a daughter, Draupadi.',
      'Dhrishtadyumna became the commander of the Pandava army in the great war at Kurukshetra.',
    ],
    today: 'the Ganga plains of Uttar Pradesh',
  },
  Purushapura: {
    kind: 'Place',
    facts: [
      'Purushapura is the old name of Peshawar, a city in Pakistan, in the ancient land of Gandhara.',
      "Queen Gandhari, mother of the hundred Kauravas, came from Gandhara. When she learned her husband Dhritarashtra was blind, she covered her own eyes with a cloth for life. Her brother was the clever Shakuni.",
    ],
    word: 'Purushapura: purusha = person, pura = city.',
    today: 'Peshawar, Pakistan',
  },
  Taxila: {
    kind: 'Place',
    facts: [
      'Takshashila (Taxila) was a famous ancient centre of learning. Students came from far away to study subjects like medicine, law and archery.',
      'The ruins of Taxila, near Islamabad in Pakistan, are a UNESCO World Heritage Site.',
      "Tradition says Janamejaya, Arjuna's great-grandson, marched to Taxila and conquered it.",
    ],
    today: 'near Islamabad, Pakistan',
  },
  'Dwaraka Outpost': {
    kind: 'Story',
    facts: [
      "Before the war, Arjuna and Duryodhana both went to Dwaraka to ask Krishna for help. Krishna gave a choice: his large army, or himself without any weapon. Arjuna chose Krishna. Duryodhana happily took the army.",
      'Krishna became Arjuna\'s charioteer. That is why he is called Parthasarathi: Partha (Arjuna) + sarathi (charioteer).',
    ],
  },
  Viratanagara: {
    kind: 'Place',
    facts: [
      "In the 13th year of their exile the Pandavas had to hide so well that no one would recognise them. They lived in disguise at King Virata's court in Viratanagara.",
      'Yudhishthira became Kanka, a courtier; Bhima was Ballava, the cook; Arjuna was Brihannala, a dance teacher; Nakula was Granthika, the horse trainer; Sahadeva was Tantipala, the cowherd; and Draupadi was Sairandhri, a maid.',
      "When the Kauravas raided Virata's cattle, Arjuna came out of disguise and defeated their whole army alone.",
    ],
    word: 'Viratanagara: nagara = city.',
    today: 'Bairat, Rajasthan',
  },
  Upaplavya: {
    kind: 'Place',
    facts: [
      "At Upaplavya, in the kingdom of Matsya, Abhimanyu (Arjuna's son) married Uttara, the daughter of King Virata.",
      'After their exile the Pandavas stayed at Upaplavya and tried for peace first. Krishna went to Hastinapura to ask for just five villages, but Duryodhana refused.',
      "Abhimanyu and Uttara's son Parikshit was born after the war, and he became king when the Pandavas later retired.",
    ],
  },
  Khandavaprastha: {
    kind: 'Place',
    facts: [
      'Khandavaprastha was dry, wild forest land. When the kingdom was divided, Dhritarashtra gave this land to the Pandavas.',
      'Agni, the god of fire, was hungry for the Khandava forest. Krishna and Arjuna helped him, and the forest burned.',
      'Agni gave Krishna a spinning discus (the Sudarshana Chakra). And at Agni\'s request, the water god Varuna gave Arjuna the Gandiva bow and two quivers that never ran empty.',
    ],
    today: 'near Delhi',
  },
  'Maya Sabha': {
    kind: 'Place',
    facts: [
      'Maya was a master architect. Arjuna saved him from the burning Khandava forest, and to say thank you Maya built the Pandavas a magical hall: the Maya Sabha.',
      "The hall was full of illusions: floors that looked like water and pools that looked like floors. Duryodhana stumbled into one and felt humiliated, which made him even more jealous of the Pandavas.",
    ],
    word: 'Sabha = an assembly hall.',
  },
  Indraprastha: {
    kind: 'Place',
    facts: [
      "Indraprastha was the Pandavas' beautiful capital, built on the land of Khandavaprastha. Many people connect it with today's Delhi, near the Purana Qila.",
      'Yudhishthira ruled fairly from Indraprastha, and held the great Rajasuya here.',
    ],
    word: "Indraprastha: Indra's plain (prastha = plateau, plain).",
    today: 'Delhi',
  },
  Chanderi: {
    kind: 'Place',
    facts: [
      "Chanderi is linked in tradition with Shishupala, king of Chedi and a cousin of Krishna.",
      "Krishna had promised Shishupala's mother he would forgive a hundred insults. At the Rajasuya Shishupala went beyond a hundred, and Krishna stopped him with his Sudarshana Chakra. Even patience has a limit!",
      'Chanderi is famous today for its light, shimmering silk-cotton fabric, used for sarees.',
    ],
    today: 'Chanderi, Madhya Pradesh',
  },
  Ujjayani: {
    kind: 'Place',
    facts: [
      'Ujjayani (Ujjain) was the capital of Avanti. In the Puranas, Krishna and his brother Balarama studied here with the sage Sandipani.',
      'In the Bhagavata stories, Krishna\'s poor friend Sudama studied with them too. Years later he brought Krishna a gift of flattened rice, and Krishna welcomed him like a king: a story about true friendship.',
      'For centuries Ujjain was used by Indian astronomers as their "zero line" for measuring time and place, like Greenwich today.',
    ],
    today: 'Ujjain, Madhya Pradesh',
  },
  Mahishmati: {
    kind: 'Place',
    facts: [
      "Mahishmati stood on the banks of the river Narmada. Many people identify it with today's Maheshwar (some say Mandhata, further along the river).",
      "On his journey south for the Rajasuya, Sahadeva visited Mahishmati and faced its king, Neela.",
      'Maheshwar is famous for handloom Maheshwari sarees. Queen Ahilyabai Holkar is said to have helped start this craft in the 1700s.',
    ],
    today: 'Maheshwar, Madhya Pradesh',
  },
  Girivraja: {
    kind: 'Place',
    facts: [
      'Girivraja was the capital of Jarasandha, the mighty king of Magadha, set among a ring of hills: giri means hill.',
      'Jarasandha held many kings as prisoners. Krishna, Bhima and Arjuna came in disguise, and Bhima wrestled Jarasandha for many days. With a hint from Krishna, Bhima won and the kings were freed.',
    ],
    word: 'Giri = hill. Vraja = a fenced place.',
    today: 'Rajgir, Bihar',
  },
  Rajagriha: {
    kind: 'Place',
    facts: [
      'Rajagriha means "the king\'s house". It is the hill-ringed city linked with Girivraja, today called Rajgir.',
      'Long after the time of the Mahabharata story, Buddha and Mahavira both spent time at Rajagriha. Rajgir still has hot springs.',
    ],
    word: 'Rajagriha: raja = king, griha = house.',
    today: 'Rajgir, Bihar',
  },
  Pataliputra: {
    kind: 'Place',
    facts: [
      "Here's a puzzle: Pataliputra was founded about 2,500 years ago, long after the time in which the Mahabharata story is set! It became the capital of Magadha later, and is today's Patna.",
      'Emperors Chandragupta Maurya and Ashoka ruled from Pataliputra. A Greek visitor named Megasthenes described the city.',
      'The city is said to be named after the patali tree, whose trumpet-shaped flowers are called patali.',
    ],
    today: 'Patna, Bihar',
  },
  Narasimha: {
    kind: 'Story',
    facts: [
      'In the Puranas, Narasimha is the man-lion form of Vishnu. A king named Hiranyakashipu had a boon: he could not be killed by man or animal, indoors or outdoors, by day or night.',
      'To protect the boy Prahlada, who loved Vishnu, Vishnu appeared as half man, half lion, at twilight, on a doorstep. Every part of the boon stayed true, yet the cruel king was stopped.',
      "The festival of Holi is linked to Prahlada's story.",
    ],
    word: 'Narasimha: nara = man, simha = lion.',
  },
  Varanavata: {
    kind: 'Place',
    facts: [
      'At Varanavata, Duryodhana secretly had a palace built from lac, a material that burns easily, hoping to trap the Pandavas inside. It was called the Lakshagriha.',
      'Wise Vidura warned the Pandavas with a coded message. They dug a secret tunnel, escaped the fire, and hid in the forest.',
    ],
    word: 'Lakshagriha: laksha = lac (resin), griha = house.',
    today: 'Barnawa, Uttar Pradesh',
  },
  Hastinapura: {
    kind: 'Place',
    facts: [
      'Hastinapura, capital of the Kurus, means "city of the elephant" (hasti = elephant). Kauravas and Pandavas grew up here.',
      'It was in Hastinapura that the fateful game of dice was played, which sent the Pandavas into exile.',
      "The old Puranas say the river Ganga flooded and washed Hastinapura away, so later kings of the family moved to Kaushambi.",
    ],
    word: 'Hastinapura: hasti = elephant, pura = city.',
    today: 'Hastinapur, near Meerut, Uttar Pradesh',
  },
  Vanavasa: {
    kind: 'Idea',
    facts: [
      'After losing the dice game, the Pandavas lived 12 years in the forest and 1 more year in disguise. Vanavasa means "living in the forest" (vana = forest, vasa = living).',
      'In the forest, the Sun god Surya gave Yudhishthira the Akshaya Patra, a magic pot that kept giving food until Draupadi had eaten.',
      'During exile Arjuna went to the Himalayas to pray to Shiva, and he received a powerful weapon for his courage and humility.',
    ],
    word: 'Vanavasa: vana = forest, vasa = living.',
  },
  Amaravati: {
    kind: 'Place',
    facts: [
      'Amaravati is the heavenly city of Indra, king of the gods. Its name means "city of the immortals".',
      "While in exile, Arjuna visited Indra's heaven, learned divine weapons, and also learned music and dance.",
      "Indra's charioteer Matali drove a shining chariot down to bring Arjuna up to heaven.",
    ],
    word: 'Amaravati: amara = immortal.',
  },
  'Go to Vanavasa': {
    kind: 'Idea',
    facts: [
      'Yudhishthira lost his kingdom, his brothers, himself and even Draupadi in the dice game. It teaches us: do not let a game or a wish to win carry you away.',
      'In the assembly Draupadi asked a famous question: could Yudhishthira stake her after he had already lost himself? The question about fairness is still discussed today.',
    ],
  },
  'Royal Tax': {
    kind: 'Idea',
    facts: [
      'Ancient texts say a king should take about one-sixth of the harvest as tax, as payment for protecting his people.',
      'Wise teachers compared a good king to a bee: it takes nectar from many flowers without harming any of them.',
    ],
  },
  'Daiva Card': {
    kind: 'Idea',
    facts: [
      'Daiva means fate or the will of the gods: the lucky or unlucky things that happen to us that we did not choose.',
      'Indian thinkers talk about daiva (fate) and purushartha (our own effort). The epic shows that both matter. Krishna told Arjuna to do his duty with full effort.',
    ],
    word: 'Daiva = fate, luck from the gods.',
  },
  'Dharma Sankat': {
    kind: 'Idea',
    facts: [
      'A sankat is a difficulty, and dharma is doing what is right. A "dharma sankat" is a hard choice where it is not easy to know the right thing to do.',
      "On the battlefield Arjuna was torn between duty and fighting his own teachers and cousins. Krishna's advice to him became the Bhagavad Gita.",
      'Karna faced a dharma sankat when Kunti asked him to join the Pandavas. He stayed loyal to Duryodhana, who had been his friend when no one else was.',
    ],
    word: 'Sankat = trouble or difficulty.',
  },
  'Nandighosha Ratha': {
    kind: 'Object',
    facts: [
      'In many tellings, Arjuna\'s chariot was called Nandighosha, "the joyful sound". Its flag showed Hanuman, who was said to be there to protect it.',
      "Krishna drove Arjuna's chariot, holding the reins instead of a weapon. Before the war began, he stopped it between the two armies and spoke the Bhagavad Gita.",
    ],
    word: 'Ratha = chariot.',
  },
  'Vijaya Ratha': {
    kind: 'Object',
    facts: [
      'Vijaya means victory. It is also the name of Karna\'s famous bow, said to have been Indra\'s bow, which his teacher Parashurama gave to him.',
      "In the war Karna's chariot wheel sank into the ground just when he needed it most. Great warriors can still be stopped by small things.",
    ],
    word: 'Vijaya = victory.',
  },
  'Celestial Ratha': {
    kind: 'Object',
    facts: [
      "Indra, king of the gods, had a shining chariot driven by Matali. Indra sent it to bring Arjuna to heaven.",
      'Matali also drove Arjuna in a heavenly battle against demons called the Nivatakavachas.',
    ],
  },
  'Divine Ratha': {
    kind: 'Object',
    facts: [
      "Krishna's own chariot was driven by Daruka, and its flag showed Garuda, the great eagle.",
      "Every Pandava brother had his own conch shell. Krishna's was Panchajanya and Arjuna's was Devadatta. They were blown to begin the war.",
    ],
  },
  'Agni Astra': {
    kind: 'Object',
    facts: [
      'An astra is a weapon in the epics that is released with a special mantra. The Agni Astra, or Agneyastra, is the weapon of fire. Drona, who learned it from the sage Agnivesha, is said to have taught it to Arjuna.',
      'In ancient India, Agni, the fire god, was the carrier of offerings: whatever was offered into the sacred fire was believed to reach the gods.',
    ],
    word: 'Astra = a weapon released by a mantra. Agni = fire.',
  },
  'Varun Astra': {
    kind: 'Object',
    facts: [
      'Varuna is the god of the waters. In the stories, the Varunastra can put out the fire of the Agneyastra: water meets fire.',
      'Varuna gave Arjuna his famous Gandiva bow and two quivers that never ran out of arrows.',
    ],
    word: 'Varuna = lord of the waters.',
  },
};

/** Gyan for a board space, if we have written some. */
export function gyanFor(index: number): { name: string; gyan: Gyan } | null {
  const s = SPACES[index];
  const g = s && GYAN[s.name];
  return g ? { name: s.name, gyan: g } : null;
}

/** Same pick on every phone: derived from the event number, never from Math.random. */
export function pickFact(g: Gyan, seed: number): string {
  return g.facts[Math.abs(seed) % g.facts.length];
}
