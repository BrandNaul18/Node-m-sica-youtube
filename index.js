const YouTube = require('youtube-search-api');
const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const ytdl = require('@distube/ytdl-core');
const path = require('path');
const app = express();

// Serve arquivos estáticos (como o áudio)
app.use(express.static(__dirname));

async function downloadAudioAsMP3(videoUrl, title, res) {
    const fileName = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.mp3'; // Cria o nome do arquivo a partir do título
    
    // Verifica se o arquivo já existe
    if (fs.existsSync(fileName)) {
        console.log('Áudio já baixado!');
        res.redirect(`/${fileName}`);  // Redireciona para o arquivo já existente
        return;
    }

    const stream = ytdl(videoUrl, { 
        filter: 'audioonly', // filtra para pegar apenas o áudio
        quality: 'highestaudio', // escolhe o melhor áudio disponível
    });

    ffmpeg()
        .input(stream)
        .audioCodec('libmp3lame') // define o codec de áudio para MP3
        .audioBitrate(192) // define o bitrate para 192 kbps
        .save(fileName) // salva o arquivo convertido com o nome baseado no título
        .on('end', () => {
            console.log('Download e conversão completos!');
            res.redirect(`/${fileName}`);  // Redireciona para o áudio convertido
        })
        .on('error', (err) => {
            console.error('Erro durante o processo: ', err);
            res.send('Erro durante o download ou conversão.');
        });
}

async function searchVideo(query, res) {
  try {
    const result = await YouTube.GetListByKeyword(query, false);
    if (result && result.items && result.items.length > 0) {
      const video = result.items[0];  // Retorna o primeiro vídeo encontrado
      console.log('Título:', video.title);  // Acessa diretamente o campo `title`
      const videoUrl = `https://www.youtube.com/watch?v=${video.id}`;
      console.log('URL do vídeo:', videoUrl);     

      // Obter informações sobre o vídeo antes de começar o download
      ytdl.getInfo(videoUrl).then(info => {
          const fileSize = info.videoDetails.lengthSeconds; // Tamanho do vídeo em segundos
          if (fileSize > 500) { // Limite de 8 minutos, por exemplo
              return res.send('O vídeo é muito longo para ser convertido.');
          }
          // Passar corretamente o título para a função de download
          downloadAudioAsMP3(videoUrl, video.title, res);
      }).catch(err => {
          console.error('Erro ao obter informações do vídeo:', err);
          res.send('Erro ao obter informações do vídeo.');
      });

    } else {
      console.log('Nenhum vídeo encontrado.');
      res.send('Nenhum vídeo encontrado.');
    }
  } catch (error) {
    console.error('Erro ao buscar vídeo:', error);
    res.send('Erro ao buscar vídeo.');
  }
}


function limparArquivosMP3() {
    const dir = __dirname; // Diretório atual
    fs.readdir(dir, (err, files) => {
        if (err) {
            console.error('Erro ao ler diretório:', err);
            return;
        }
        files.forEach(file => {
            if (file.endsWith('.mp3')) {
                const filePath = path.join(dir, file);
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error(`Erro ao excluir ${file}:`, err);
                    } else {
                        console.log(`Arquivo removido: ${file}`);
                    }
                });
            }
        });
    });
}

// limpar todas musicas apos iniciar
limparArquivosMP3();

app.get('/', (req, res) => {
  res.status(400).json({ error: "A consulta não pode estar vazia ou apenas com espaços." });
});

app.get('/:query', (req, res) => {
  const query = req.params.query;
  if (query.length > 100) {
    return res.status(400).json({ error: "Consulta muito longa" }); // Limita o tamanho da string
  }
  if (query.includes("..") || query.includes("/")) {
    return res.status(400).json({ error: "Consulta inválida" }); // Previne ataques de Directory Traversal
  }  
  if (/[<>{}[\]()"'`!@#$%^&*+=]/.test(query)) {
    return res.status(400).json({ error: "Caracteres inválidos na consulta" }); // Bloqueia caracteres especiais perigosos
  } 
  searchVideo(query, res);
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});

//uso: http://localhost:3000/nome da musica