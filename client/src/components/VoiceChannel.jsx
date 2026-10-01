import React, { useEffect, useState, useRef } from 'react';
import { useServerStore } from '../store/useServerStore';
import { useAuthStore } from '../store/useAuthStore';
import { getSocket } from '../utils/socket';
import api from '../utils/api';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];

function hasActiveVideo(stream) {
  if (!stream) return false;
  const videoTracks = stream.getVideoTracks();
  return videoTracks.some((t) => t.enabled && t.readyState === 'live');
}

// Audio Level Hook for Discord-like speaking indicator
function useAudioLevel(stream, enabled = true) {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!stream || !enabled) {
      setIsSpeaking(false);
      return;
    }
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled) {
      setIsSpeaking(false);
      return;
    }

    let audioContext = null;
    let analyser = null;
    let microphone = null;
    let animId = null;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioCtx();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        setIsSpeaking(average > 10);
        animId = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      // AudioContext fallback
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
    };
  }, [stream, enabled]);

  return isSpeaking;
}

export default function VoiceChannel() {
  const { activeChannel, channels, selectChannel } = useServerStore();
  const { user } = useAuthStore();

  const [localStream, setLocalStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [spotlightId, setSpotlightId] = useState(null); // null (grid) or 'local' or socketId
  const [isChatOpen, setIsChatOpen] = useState(true);

  const [participants, setParticipants] = useState([]); // [{ socketId, userId, username, avatar }]
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> MediaStream
  const [iceServers, setIceServers] = useState(DEFAULT_ICE_SERVERS);

  const peerConnections = useRef({}); // socketId -> RTCPeerConnection
  const localStreamRef = useRef(null);
  const cameraTrackRef = useRef(null);
  const screenTrackRef = useRef(null);
  const iceCandidateQueues = useRef({}); // socketId -> RTCIceCandidateInit[]
  const iceServersRef = useRef(DEFAULT_ICE_SERVERS);

  // Audio speaking indicator for local user
  const isLocalSpeaking = useAudioLevel(localStream, !isMuted && !isDeafened);

  // Fetch TURN credentials on mount
  useEffect(() => {
    async function fetchTurnConfig() {
      try {
        const res = await api.get('/turn-credentials');
        if (res.data?.iceServers?.length > 0) {
          setIceServers(res.data.iceServers);
          iceServersRef.current = res.data.iceServers;
        }
      } catch (err) {
        console.warn('Could not fetch turn credentials, using defaults:', err.message);
      }
    }
    fetchTurnConfig();
  }, []);

  const processIceQueue = async (socketId, pc) => {
    const queue = iceCandidateQueues.current[socketId] || [];
    while (queue.length > 0) {
      const candidate = queue.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error('Error adding queued ICE candidate:', e);
      }
    }
  };

  useEffect(() => {
    let socket = getSocket();
    if (!socket || !activeChannel || activeChannel.type !== 'voice') return;

    const channelId = activeChannel._id;

    async function initVoice() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = stream;
        setLocalStream(stream);

        const currentSocket = getSocket();
        if (currentSocket) {
          currentSocket.emit('join_voice_channel', { channelId });
        }
      } catch (err) {
        console.error('Failed to get microphone access:', err);
        alert('Microphone access is required for voice chat.');
      }
    }

    const handleVoiceRoomUsers = async (existingUsers) => {
      setParticipants(existingUsers);
      for (const targetUser of existingUsers) {
        await createOfferForPeer(targetUser.socketId, localStreamRef.current);
      }
    };

    const handleVoiceUserJoined = (newUser) => {
      setParticipants((prev) => {
        const exists = prev.some((p) => p.socketId === newUser.socketId);
        if (exists) return prev;
        return [...prev, newUser];
      });
    };

    const handleVoiceOffer = async ({ senderSocketId, offer }) => {
      await handleReceiveOffer(senderSocketId, offer, localStreamRef.current);
    };

    const handleVoiceAnswer = async ({ senderSocketId, answer }) => {
      const pc = peerConnections.current[senderSocketId];
      if (pc && pc.signalingState !== 'closed') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await processIceQueue(senderSocketId, pc);
      }
    };

    const handleVoiceIceCandidate = async ({ senderSocketId, candidate }) => {
      const pc = peerConnections.current[senderSocketId];
      if (pc && pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      } else {
        if (!iceCandidateQueues.current[senderSocketId]) {
          iceCandidateQueues.current[senderSocketId] = [];
        }
        iceCandidateQueues.current[senderSocketId].push(candidate);
      }
    };

    const handleVoiceUserLeft = ({ socketId }) => {
      removePeer(socketId);
      setSpotlightId((prev) => (prev === socketId ? null : prev));
    };

    const handleConnect = () => {
      const s = getSocket();
      if (s && activeChannel?._id) {
        s.emit('join_voice_channel', { channelId: activeChannel._id });
      }
    };

    socket.on('voice_room_users', handleVoiceRoomUsers);
    socket.on('voice_user_joined', handleVoiceUserJoined);
    socket.on('voice_offer', handleVoiceOffer);
    socket.on('voice_answer', handleVoiceAnswer);
    socket.on('voice_ice_candidate', handleVoiceIceCandidate);
    socket.on('voice_user_left', handleVoiceUserLeft);
    socket.on('connect', handleConnect);

    initVoice();

    return () => {
      if (socket) {
        socket.off('voice_room_users', handleVoiceRoomUsers);
        socket.off('voice_user_joined', handleVoiceUserJoined);
        socket.off('voice_offer', handleVoiceOffer);
        socket.off('voice_answer', handleVoiceAnswer);
        socket.off('voice_ice_candidate', handleVoiceIceCandidate);
        socket.off('voice_user_left', handleVoiceUserLeft);
        socket.off('connect', handleConnect);
      }
      leaveVoiceCall();
    };
  }, [activeChannel?._id]);

  const createPeerConnection = (targetSocketId, stream) => {
    if (peerConnections.current[targetSocketId]) {
      return peerConnections.current[targetSocketId];
    }

    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    peerConnections.current[targetSocketId] = pc;

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE Connection State [${targetSocketId}]:`, pc.iceConnectionState);
    };

    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket?.emit('voice_ice_candidate', {
          targetSocketId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0] || new MediaStream([event.track]);

      const updateRemoteStream = () => {
        setRemoteStreams((prev) => ({
          ...prev,
          [targetSocketId]: new MediaStream(remoteStream.getTracks()),
        }));
      };

      updateRemoteStream();

      if (event.track) {
        event.track.onunmute = updateRemoteStream;
        event.track.onmute = updateRemoteStream;
        event.track.onended = updateRemoteStream;
      }
    };

    return pc;
  };

  const createOfferForPeer = async (targetSocketId, stream) => {
    const pc = createPeerConnection(targetSocketId, stream);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const socket = getSocket();
    socket?.emit('voice_offer', {
      targetSocketId,
      offer,
    });
  };

  const handleReceiveOffer = async (senderSocketId, offer, stream) => {
    const pc = createPeerConnection(senderSocketId, stream);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    await processIceQueue(senderSocketId, pc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const socket = getSocket();
    socket?.emit('voice_answer', {
      targetSocketId: senderSocketId,
      answer,
    });
  };

  const removePeer = (targetSocketId) => {
    if (peerConnections.current[targetSocketId]) {
      peerConnections.current[targetSocketId].close();
      delete peerConnections.current[targetSocketId];
    }
    delete iceCandidateQueues.current[targetSocketId];

    setParticipants((prev) => prev.filter((p) => p.socketId !== targetSocketId));
    setRemoteStreams((prev) => {
      const updated = { ...prev };
      delete updated[targetSocketId];
      return updated;
    });
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleDeafen = () => {
    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);
    if (nextDeafened && !isMuted) {
      toggleMute();
    }
  };

  const toggleCamera = async () => {
    try {
      if (isCameraOn) {
        if (cameraTrackRef.current) {
          cameraTrackRef.current.stop();
          cameraTrackRef.current = null;
        }
        setIsCameraOn(false);

        if (localStreamRef.current) {
          const vTrack = localStreamRef.current.getVideoTracks()[0];
          if (vTrack) {
            localStreamRef.current.removeTrack(vTrack);
            vTrack.stop();
          }
        }

        Object.keys(peerConnections.current).forEach((sId) => {
          const pc = peerConnections.current[sId];
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(null);
          }
        });

        setLocalStream(new MediaStream(localStreamRef.current ? localStreamRef.current.getTracks() : []));
      } else {
        if (isScreenSharing) {
          stopScreenShare();
        }

        const camStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        const videoTrack = camStream.getVideoTracks()[0];
        cameraTrackRef.current = videoTrack;
        setIsCameraOn(true);

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }
        localStreamRef.current.addTrack(videoTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        for (const sId of Object.keys(peerConnections.current)) {
          const pc = peerConnections.current[sId];
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            await sender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, localStreamRef.current);
            await createOfferForPeer(sId, localStreamRef.current);
          }
        }
      }
    } catch (err) {
      console.error('Failed to toggle camera:', err);
      alert('Could not access camera.');
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = displayStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;
        setIsScreenSharing(true);

        screenTrack.onended = () => {
          stopScreenShare();
        };

        if (cameraTrackRef.current) {
          cameraTrackRef.current.stop();
          cameraTrackRef.current = null;
          setIsCameraOn(false);
        }

        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }

        const existingVTrack = localStreamRef.current.getVideoTracks()[0];
        if (existingVTrack) {
          localStreamRef.current.removeTrack(existingVTrack);
          existingVTrack.stop();
        }

        localStreamRef.current.addTrack(screenTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

        for (const sId of Object.keys(peerConnections.current)) {
          const pc = peerConnections.current[sId];
          const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
          if (sender) {
            await sender.replaceTrack(screenTrack);
          } else {
            pc.addTrack(screenTrack, localStreamRef.current);
            await createOfferForPeer(sId, localStreamRef.current);
          }
        }
      } catch (err) {
        console.error('Failed to start screen share:', err);
      }
    }
  };

  const stopScreenShare = () => {
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    setIsScreenSharing(false);

    if (localStreamRef.current) {
      const vTrack = localStreamRef.current.getVideoTracks()[0];
      if (vTrack) {
        localStreamRef.current.removeTrack(vTrack);
        vTrack.stop();
      }
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    }

    Object.keys(peerConnections.current).forEach((sId) => {
      const pc = peerConnections.current[sId];
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(null);
      }
    });
  };

  const leaveVoiceCall = () => {
    if (isScreenSharing) stopScreenShare();
    if (cameraTrackRef.current) {
      cameraTrackRef.current.stop();
      cameraTrackRef.current = null;
    }

    const socket = getSocket();
    socket?.emit('leave_voice_channel');

    Object.keys(peerConnections.current).forEach((sId) => {
      peerConnections.current[sId].close();
    });
    peerConnections.current = {};
    iceCandidateQueues.current = {};

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    setParticipants([]);
    setRemoteStreams({});
    setIsCameraOn(false);
    setIsScreenSharing(false);
    setSpotlightId(null);
  };

  const handleDisconnect = () => {
    leaveVoiceCall();
    const textChannel = channels.find((c) => c.type === 'text' || !c.type);
    if (textChannel) {
      selectChannel(textChannel);
    } else {
      useServerStore.setState({ activeChannel: null });
    }
  };

  if (!activeChannel || activeChannel.type !== 'voice') return null;

  const hasLocalVideo = hasActiveVideo(localStream);
  const totalCount = participants.length + 1;

  let gridColsClass = 'grid-cols-1 md:grid-cols-2';
  if (totalCount >= 3 && totalCount <= 4) gridColsClass = 'grid-cols-2 md:grid-cols-2';
  if (totalCount > 4) gridColsClass = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';

  return (
    <div className="flex flex-1 h-full w-full overflow-hidden select-none">
      {/* Main Voice & Video Section */}
      <div className="flex flex-1 flex-col bg-[#101222] p-6 justify-between overflow-hidden">
        {/* Remote Audio Elements */}
        <div>
          {Object.entries(remoteStreams).map(([socketId, stream]) => (
            <AudioElement key={socketId} stream={stream} isDeafened={isDeafened} />
          ))}
        </div>

        {/* Voice Room Header */}
        <div className="flex items-center justify-between border-b border-[#1c1f3b] pb-3 mb-2">
          <div>
            <div className="flex items-center space-x-2 text-2xl font-bold text-white mb-0.5">
              <span className="text-green-400">🔊</span>
              <span>{activeChannel.name}</span>
            </div>
            <p className="text-xs text-gray-400">
              P2P Mesh Call • {totalCount} participant{totalCount > 1 ? 's' : ''} connected
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                isChatOpen
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow'
                  : 'bg-[#2b2d31] hover:bg-[#35373c] text-gray-300 border-[#3f4147]'
              }`}
              title="Toggle Voice Channel Chat"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{isChatOpen ? 'Hide Chat' : 'Text Chat'}</span>
            </button>

            {spotlightId && (
              <button
                onClick={() => setSpotlightId(null)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#2b2d31] hover:bg-[#35373c] text-xs text-gray-300 font-semibold border border-[#3f4147] transition-colors cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span>Exit Spotlight View</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Grid or Spotlight View */}
        {spotlightId ? (
          /* Spotlight Layout */
          <div className="flex-1 flex flex-col my-2 overflow-hidden gap-3">
            {/* Top Participants Ribbon */}
            <div className="flex items-center space-x-3 overflow-x-auto pb-2 border-b border-[#3f4147]/40 min-h-[90px]">
              {/* Local User Card Mini */}
              <ParticipantTile
                isLocal={true}
                user={user}
                stream={localStream}
                isMuted={isMuted}
                isSpeaking={isLocalSpeaking}
                isScreenSharing={isScreenSharing}
                isMini={true}
                isFocused={spotlightId === 'local'}
                onClick={() => setSpotlightId(spotlightId === 'local' ? null : 'local')}
              />
              {/* Remote Cards Mini */}
              {participants.map((participant) => (
                <ParticipantTile
                  key={participant.socketId}
                  isLocal={false}
                  user={participant}
                  stream={remoteStreams[participant.socketId]}
                  isMini={true}
                  isFocused={spotlightId === participant.socketId}
                  onClick={() => setSpotlightId(spotlightId === participant.socketId ? null : participant.socketId)}
                />
              ))}
            </div>

            {/* Large Spotlight Focused Card */}
            <div className="flex-1 flex items-center justify-center overflow-hidden">
              {spotlightId === 'local' ? (
                <ParticipantTile
                  isLocal={true}
                  user={user}
                  stream={localStream}
                  isMuted={isMuted}
                  isSpeaking={isLocalSpeaking}
                  isScreenSharing={isScreenSharing}
                  isSpotlightLarge={true}
                  onClick={() => setSpotlightId(null)}
                />
              ) : (
                <ParticipantTile
                  isLocal={false}
                  user={participants.find((p) => p.socketId === spotlightId)}
                  stream={remoteStreams[spotlightId]}
                  isSpotlightLarge={true}
                  onClick={() => setSpotlightId(null)}
                />
              )}
            </div>
          </div>
        ) : (
          /* Regular Grid Layout */
          <div className={`my-4 flex-1 grid ${gridColsClass} gap-4 items-center justify-center overflow-y-auto`}>
            {/* Local User Card */}
            <ParticipantTile
              isLocal={true}
              user={user}
              stream={localStream}
              isMuted={isMuted}
              isSpeaking={isLocalSpeaking}
              isScreenSharing={isScreenSharing}
              onClick={() => setSpotlightId('local')}
            />

            {/* Remote Participants Cards */}
            {participants.map((participant) => (
              <ParticipantTile
                key={participant.socketId}
                isLocal={false}
                user={participant}
                stream={remoteStreams[participant.socketId]}
                onClick={() => setSpotlightId(participant.socketId)}
              />
            ))}
          </div>
        )}

        {/* Control Action Bar */}
        <div className="flex items-center justify-center space-x-3 bg-[#232428] p-3 rounded-2xl shadow-xl border border-[#2b2d31]">
          {/* Mute Mic Button */}
          <button
            onClick={toggleMute}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-full font-semibold text-xs transition-colors cursor-pointer ${
              isMuted
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-[#35373c] text-white hover:bg-[#404249]'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span>Unmute</span>
              </>
            ) : (
              <>
                <svg className="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span>Mute</span>
              </>
            )}
          </button>

          {/* Deafen Button */}
          <button
            onClick={toggleDeafen}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-full font-semibold text-xs transition-colors cursor-pointer ${
              isDeafened
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-[#35373c] text-white hover:bg-[#404249]'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen (Mute incoming audio & mic)'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              {isDeafened && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />}
            </svg>
            <span>{isDeafened ? 'Deafened' : 'Deafen'}</span>
          </button>

          {/* Camera Toggle Button */}
          <button
            onClick={toggleCamera}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-full font-semibold text-xs transition-colors cursor-pointer ${
              isCameraOn
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-[#35373c] text-white hover:bg-[#404249]'
            }`}
            title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>{isCameraOn ? 'Camera On' : 'Camera Off'}</span>
          </button>

          {/* Share Screen Button */}
          <button
            onClick={toggleScreenShare}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-full font-semibold text-xs transition-colors cursor-pointer ${
              isScreenSharing
                ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'bg-[#35373c] text-white hover:bg-[#404249]'
            }`}
            title={isScreenSharing ? 'Stop Sharing Screen' : 'Share Screen'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span>{isScreenSharing ? 'Stop Sharing' : 'Share Screen'}</span>
          </button>

          {/* Text Chat Toggle Button */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`flex items-center space-x-2 px-4 py-2.5 rounded-full font-semibold text-xs transition-colors cursor-pointer ${
              isChatOpen
                ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                : 'bg-[#35373c] text-white hover:bg-[#404249]'
            }`}
            title={isChatOpen ? 'Hide Text Chat' : 'Show Text Chat'}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>{isChatOpen ? 'Hide Chat' : 'Text Chat'}</span>
          </button>

          {/* Disconnect Call Button */}
          <button
            onClick={handleDisconnect}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-full font-semibold text-xs bg-red-600 text-white hover:bg-red-700 transition-colors shadow-md cursor-pointer"
            title="Disconnect from Call"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.684A1 1 0 008.279 3H5z"
              />
            </svg>
            <span>Disconnect</span>
          </button>
        </div>
      </div>

      {/* Right Voice Channel Text Chat Panel */}
      {isChatOpen && (
        <div className="flex w-80 lg:w-96 flex-col bg-[#2b2d31] border-l border-[#1f2023] overflow-hidden">
          {/* Header */}
          <div className="flex h-12 items-center justify-between border-b border-[#1f2023] px-4 font-bold text-white shadow-sm bg-[#2b2d31]">
            <div className="flex items-center space-x-2 truncate">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span className="truncate">{activeChannel.name}</span>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="Close Voice Chat"
            >
              ✕
            </button>
          </div>

          {/* Voice Chat Message Area & Input */}
          <div className="flex flex-1 flex-col overflow-hidden bg-[#313338]">
            <MessageList />
            <MessageInput />
          </div>
        </div>
      )}
    </div>
  );
}

// Single Participant Tile Component (Supports Video, Avatar, Speaking Indicator, and Spotlight)
function ParticipantTile({
  isLocal,
  user,
  stream,
  isMuted = false,
  isSpeaking: externalIsSpeaking,
  isScreenSharing = false,
  isMini = false,
  isSpotlightLarge = false,
  isFocused = false,
  onClick,
}) {
  const internalIsSpeaking = useAudioLevel(stream, !isLocal || !isMuted);
  const isSpeaking = externalIsSpeaking !== undefined ? externalIsSpeaking : internalIsSpeaking;
  const hasVideo = hasActiveVideo(stream);

  let containerClass =
    'relative flex flex-col items-center justify-center bg-[#2b2d31] rounded-2xl shadow-md overflow-hidden transition-all duration-200 cursor-pointer group ';

  if (isMini) {
    containerClass += `h-20 w-32 flex-shrink-0 border-2 ${
      isFocused ? 'border-indigo-500 scale-105' : 'border-[#3f4147]'
    }`;
  } else if (isSpotlightLarge) {
    containerClass += 'w-full h-full max-h-[600px] border-2 border-indigo-500/70 aspect-video';
  } else {
    containerClass += `aspect-video border-2 ${
      isSpeaking ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]' : 'border-[#3f4147] hover:border-indigo-500/50'
    }`;
  }

  return (
    <div onClick={onClick} className={containerClass}>
      {hasVideo ? (
        <VideoElement stream={stream} isLocal={isLocal} />
      ) : (
        <div className="flex flex-col items-center justify-center">
          <div className="relative mb-1">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt="Avatar"
                className={`${isMini ? 'h-9 w-9' : 'h-16 w-16'} rounded-full object-cover transition-all ${
                  isSpeaking ? 'ring-4 ring-green-500 ring-offset-2 ring-offset-[#2b2d31]' : ''
                }`}
              />
            ) : (
              <div
                className={`${
                  isMini ? 'h-9 w-9 text-sm' : 'h-16 w-16 text-2xl'
                } rounded-full ${
                  isLocal ? 'bg-indigo-600' : 'bg-purple-600'
                } flex items-center justify-center text-white font-bold transition-all ${
                  isSpeaking ? 'ring-4 ring-green-500 ring-offset-2 ring-offset-[#2b2d31]' : ''
                }`}
              >
                {user?.username?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <span
              className={`absolute bottom-0 right-0 ${
                isMini ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'
              } rounded-full border-2 border-[#2b2d31] ${isMuted ? 'bg-red-500' : 'bg-green-500'}`}
            />
          </div>
        </div>
      )}

      {/* User overlay badge */}
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded text-xs text-white font-semibold flex items-center space-x-1.5 z-10">
        <span className="truncate max-w-[120px]">
          {user?.username} {isLocal ? '(You)' : ''}
        </span>
        {isScreenSharing && <span className="text-[10px] text-indigo-400 font-bold">🖥️ Screen</span>}
        {isMuted && <span className="text-[10px] text-red-400">🔇 Muted</span>}
      </div>
    </div>
  );
}

// Remote Audio Component
function AudioElement({ stream, isDeafened }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
      audioRef.current.muted = isDeafened;
      audioRef.current.play().catch((err) => {
        console.log('Audio playback error:', err);
      });
    }
  }, [stream, isDeafened]);

  return <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />;
}

// Video element for stream rendering
function VideoElement({ stream, isLocal = false }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={isLocal}
      className="h-full w-full object-cover rounded-xl"
    />
  );
}
