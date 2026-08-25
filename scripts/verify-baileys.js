import { proto, generateWAMessageFromContent } from '@whiskeysockets/baileys';

console.log('=== BAILEYS PROTO VERIFICATION ===');
console.log('proto.Message.InteractiveMessage:', !!proto.Message.InteractiveMessage);
if (proto.Message.InteractiveMessage) {
  console.log('InteractiveMessage keys:', Object.keys(proto.Message.InteractiveMessage));
  console.log('CarouselMessage:', !!proto.Message.InteractiveMessage.CarouselMessage);
  console.log('NativeFlowMessage:', !!proto.Message.InteractiveMessage.NativeFlowMessage);
  console.log('Header:', !!proto.Message.InteractiveMessage.Header);
  console.log('Body:', !!proto.Message.InteractiveMessage.Body);
  console.log('Footer:', !!proto.Message.InteractiveMessage.Footer);
}
console.log('proto.Message.ButtonsMessage:', !!proto.Message.ButtonsMessage);
console.log('proto.Message.ListMessage:', !!proto.Message.ListMessage);
console.log('proto.Message.TemplateMessage:', !!proto.Message.TemplateMessage);
console.log('generateWAMessageFromContent:', typeof generateWAMessageFromContent);
