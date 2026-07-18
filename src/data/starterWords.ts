import type { CefrLevel, PartOfSpeech } from '../domain/types'

export interface StarterWord {
  english: string
  vietnamese: string
  tier: 1 | 2 | 3
  partOfSpeech: PartOfSpeech
  cefr: CefrLevel
}

const withCefr = (tier: 1 | 2 | 3): CefrLevel => (tier === 1 ? 'A1' : tier === 2 ? 'A2' : 'B1')
const word = (english: string, vietnamese: string, tier: 1 | 2 | 3, partOfSpeech: PartOfSpeech): StarterWord => ({
  english,
  vietnamese,
  tier,
  partOfSpeech,
  cefr: withCefr(tier),
})

export const STARTER_WORDS: StarterWord[] = [
  word('house', 'nhà', 1, 'noun'), word('dog', 'con chó', 1, 'noun'),
  word('water', 'nước', 1, 'noun'), word('book', 'sách', 1, 'noun'),
  word('tree', 'cây', 1, 'noun'), word('food', 'thức ăn', 1, 'noun'),
  word('friend', 'bạn bè', 1, 'noun'), word('car', 'xe hơi', 1, 'noun'),
  word('school', 'trường học', 1, 'noun'), word('sun', 'mặt trời', 1, 'noun'),
  word('bridge', 'cây cầu', 2, 'noun'), word('market', 'chợ', 2, 'noun'),
  word('mountain', 'ngọn núi', 2, 'noun'), word('weather', 'thời tiết', 2, 'noun'),
  word('machine', 'máy móc', 2, 'noun'), word('neighbor', 'hàng xóm', 2, 'noun'),
  word('challenge', 'thử thách', 3, 'noun'), word('opportunity', 'cơ hội', 3, 'noun'),
  word('environment', 'môi trường', 3, 'noun'), word('government', 'chính phủ', 3, 'noun'),
  word('eat', 'ăn', 1, 'verb'), word('run', 'chạy', 1, 'verb'),
  word('sleep', 'ngủ', 1, 'verb'), word('read', 'đọc', 1, 'verb'),
  word('write', 'viết', 1, 'verb'), word('walk', 'đi bộ', 1, 'verb'),
  word('drink', 'uống', 1, 'verb'), word('play', 'chơi', 1, 'verb'),
  word('sing', 'hát', 1, 'verb'), word('explain', 'giải thích', 2, 'verb'),
  word('decide', 'quyết định', 2, 'verb'), word('remember', 'nhớ', 2, 'verb'),
  word('forget', 'quên', 2, 'verb'), word('improve', 'cải thiện', 2, 'verb'),
  word('discover', 'khám phá', 2, 'verb'), word('borrow', 'mượn', 2, 'verb'),
  word('negotiate', 'đàm phán', 3, 'verb'), word('accomplish', 'hoàn thành', 3, 'verb'),
  word('overcome', 'vượt qua', 3, 'verb'), word('hesitate', 'do dự', 3, 'verb'),
  word('big', 'to lớn', 1, 'adjective'), word('small', 'nhỏ', 1, 'adjective'),
  word('hot', 'nóng', 1, 'adjective'), word('cold', 'lạnh', 1, 'adjective'),
  word('happy', 'vui', 1, 'adjective'), word('sad', 'buồn', 1, 'adjective'),
  word('fast', 'nhanh', 1, 'adjective'), word('slow', 'chậm', 1, 'adjective'),
  word('new', 'mới', 1, 'adjective'), word('difficult', 'khó khăn', 2, 'adjective'),
  word('beautiful', 'đẹp', 2, 'adjective'), word('dangerous', 'nguy hiểm', 2, 'adjective'),
  word('expensive', 'đắt', 2, 'adjective'), word('comfortable', 'thoải mái', 2, 'adjective'),
  word('important', 'quan trọng', 2, 'adjective'), word('reluctant', 'miễn cưỡng', 3, 'adjective'),
  word('ambitious', 'tham vọng', 3, 'adjective'), word('meticulous', 'tỉ mỉ', 3, 'adjective'),
  word('resilient', 'kiên cường', 3, 'adjective'),
  word('good morning', 'chào buổi sáng', 1, 'phrase'), word('thank you', 'cảm ơn', 1, 'phrase'),
  word('how are you', 'bạn khỏe không', 1, 'phrase'), word('see you later', 'hẹn gặp lại', 1, 'phrase'),
  word('never mind', 'không sao đâu', 2, 'phrase'), word('take care', 'giữ gìn sức khỏe', 2, 'phrase'),
  word('on time', 'đúng giờ', 2, 'phrase'), word('right away', 'ngay lập tức', 2, 'phrase'),
  word('piece of cake', 'dễ như ăn bánh', 3, 'phrase'), word('break the ice', 'phá vỡ sự ngại ngùng', 3, 'phrase'),
  word('under the weather', 'không được khỏe', 3, 'phrase'), word('hit the road', 'lên đường', 3, 'phrase'),
  word('once in a while', 'thỉnh thoảng', 3, 'phrase'),
]
